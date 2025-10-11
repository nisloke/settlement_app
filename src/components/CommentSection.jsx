import React, { useState, useEffect } from 'react';
import imageCompression from 'browser-image-compression';
import { supabase } from '../supabaseClient';

const CommentSection = ({ settlementId, isGuest, isOwner }) => {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [imageFiles, setImageFiles] = useState([]);
  const [guestName, setGuestName] = useState('');
  const [guestPassword, setGuestPassword] = useState('');
  const [currentUserId, setCurrentUserId] = useState(null);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingContent, setEditingContent] = useState('');
  const [modalImageUrl, setModalImageUrl] = useState(null);
  const [guestPasswords, setGuestPasswords] = useState({}); // To store passwords for each guest comment

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length + imageFiles.length > 10) {
      alert('이미지는 최대 10장까지 첨부할 수 있습니다.');
      return;
    }
    setImageFiles(prevFiles => [...prevFiles, ...files]);
  };

  useEffect(() => {
    if (!settlementId) return;

    const setup = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id);

      const { data, error } = await supabase
        .from('comments')
        .select('*')
        .eq('settlement_id', settlementId)
        .not('is_deleted', 'eq', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching comments:', error);
      } else {
        setComments(data);
      }
    };

    setup();

    // Real-time subscription for comments
    const subscription = supabase
      .channel(`comments-for-${settlementId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'comments', filter: `settlement_id=eq.${settlementId}` },
        (payload) => {
          // Ensure we don't add already deleted items, though the fetch query should prevent this.
          if (!payload.new.is_deleted) {
            setComments((prevComments) => 
              // Avoid duplicates
              prevComments.some(c => c.id === payload.new.id) ? prevComments : [payload.new, ...prevComments]
            );
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'comments', filter: `settlement_id=eq.${settlementId}` },
        (payload) => {
          if (payload.new.is_deleted) {
            setComments((prevComments) => prevComments.filter(c => c.id !== payload.new.id));
          } else {
            // Handle comment content updates if/when edit functionality is added
            setComments((prevComments) => prevComments.map(c => c.id === payload.new.id ? payload.new : c));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [settlementId]);

  const handlePostComment = async () => {
    if ((newComment.trim() === '' && imageFiles.length === 0) || !settlementId) return;

    let uploadedImageUrls = [];

    if (imageFiles.length > 0) {
      const uploadPromises = imageFiles.map(async (file) => {
        const options = {
          maxSizeMB: 1,
          maxWidthOrHeight: 1920,
          useWebWorker: true,
          fileType: 'image/webp',
        };
        try {
          const compressedFile = await imageCompression(file, options);
          const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.webp`;
          const filePath = `public/comments/${settlementId}/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('comment_images')
            .upload(filePath, compressedFile);

          if (uploadError) {
            throw uploadError;
          }

          const { data: urlData } = supabase.storage
            .from('comment_images')
            .getPublicUrl(filePath);
          
          return urlData.publicUrl;
        } catch (error) {
          console.error('Error processing or uploading image:', error);
          throw error;
        }
      });

      try {
        uploadedImageUrls = await Promise.all(uploadPromises);
      } catch (error) {
        alert('일부 또는 전체 이미지 업로드에 실패했습니다.');
        return;
      }
    }

    const commentData = {
      content: newComment,
      settlement_id: settlementId,
      image_url: uploadedImageUrls, // Array of URLs
    };

    if (isGuest) {
      if (guestName.trim() === '' || guestPassword.trim() === '') {
        alert('이름과 비밀번호를 모두 입력해주세요.');
        return;
      }
      // Assuming add_guest_comment RPC is updated to accept a jsonb image_url
      const { error } = await supabase.rpc('add_guest_comment', {
        settlement_id_arg: settlementId,
        guest_name_arg: guestName,
        password_arg: guestPassword,
        content_arg: newComment,
        image_url_arg: uploadedImageUrls,
      });

      if (error) {
        console.error('Error posting guest comment:', error);
      } else {
        setNewComment('');
        setImageFiles([]);
        setGuestName('');
        setGuestPassword('');
      }
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('comments')
        .insert([
          {
            ...commentData,
            user_id: user.id,
            guest_name: '총무',
          }
        ])
        .select();

      if (error) {
        console.error('Error posting comment:', error);
      } else {
        setNewComment('');
        setImageFiles([]);
      }
    }
  };

  const handleUpdateComment = async (commentId) => {
    const commentToEdit = comments.find(c => c.id === commentId);
    if (!commentToEdit) return;

    const isGuestComment = !!commentToEdit.password_hash;

    if (isGuestComment) {
      const password = guestPasswords[commentId] || '';
      if (password.trim() === '') {
        alert('비밀번호를 입력해주세요.');
        return;
      }

      const { data, error } = await supabase.rpc('update_guest_comment', {
        comment_id_arg: commentId,
        password_arg: password,
        new_content_arg: editingContent
      });

      if (error) {
        alert('댓글 수정 중 오류가 발생했습니다.');
        console.error('Error calling update_guest_comment:', error);
      } else if (data === true) {
        setEditingCommentId(null);
        setEditingContent('');
      } else {
        alert('비밀번호가 일치하지 않아 댓글을 수정할 수 없습니다.');
      }
    } else {
      // Logic for authenticated user's comment
      const { error } = await supabase
        .from('comments')
        .update({ content: editingContent })
        .eq('id', commentId);

      if (error) {
        alert('댓글 수정에 실패했습니다.');
        console.error('Error updating comment:', error);
      } else {
        setEditingCommentId(null);
        setEditingContent('');
      }
    }
  };

  const startEditing = async (comment) => {
    const isGuestComment = !!comment.password_hash;
    const isUserAuthenticated = !!currentUserId && !isGuest;

    if (isGuestComment && !isUserAuthenticated) { // Guest editing their own comment
      const password = guestPasswords[comment.id] || '';
      if (password.trim() === '') {
        alert('비밀번호를 입력해주세요.');
        return;
      }

      const { data, error } = await supabase.rpc('verify_guest_password', {
        comment_id_arg: comment.id,
        password_arg: password
      });

      if (error) {
        alert('비밀번호 검증 중 오류가 발생했습니다.');
        return;
      }

      if (data === true) {
        setEditingCommentId(comment.id);
        setEditingContent(comment.content);
      } else {
        alert('비밀번호가 일치하지 않습니다.');
      }
    } else { // Owner or own comment
      setEditingCommentId(comment.id);
      setEditingContent(comment.content);
    }
  };

  const cancelEditing = () => {
    setEditingCommentId(null);
    setEditingContent('');
  };

  const handlePasswordChange = (commentId, password) => {
    setGuestPasswords(prev => ({ ...prev, [commentId]: password }));
  };

  const performDelete = async (commentId) => {
    const { error } = await supabase
      .from('comments')
      .update({ is_deleted: true })
      .eq('id', commentId);

    if (error) {
      console.error('Error soft-deleting comment:', error);
      alert('댓글 삭제 중 오류가 발생했습니다.');
    } else {
      setComments(comments.filter(c => c.id !== commentId));
    }
  };

  const handleDeleteComment = async (comment) => {
    const isGuestComment = !!comment.password_hash;
    const isUserAuthenticated = !!currentUserId && !isGuest;

    if (isOwner) {
      if (window.confirm('관리자 권한으로 댓글을 삭제하시겠습니까?')) {
        await performDelete(comment.id);
      }
      return;
    }

    if (isGuestComment) {
      if (isUserAuthenticated) {
        if (window.confirm('인증된 사용자로 게스트의 댓글을 삭제하시겠습니까? (비밀번호 불필요)')) {
          await performDelete(comment.id);
        }
      } else { // Guest deleting their own comment
        const password = guestPasswords[comment.id] || '';
        if (password.trim() === '') {
          alert('비밀번호를 입력해주세요.');
          return;
        }

        const { data, error } = await supabase.rpc('soft_delete_guest_comment', { 
          comment_id_arg: comment.id,
          password_arg: password
        });

        if (error) {
          console.error('Error in RPC soft_delete_guest_comment:', error);
          alert('댓글 삭제 중 오류가 발생했습니다.');
        } else if (data === false) {
          alert('비밀번호가 일치하지 않습니다.');
        } else {
          setComments(comments.filter(c => c.id !== comment.id));
        }
      }
    } else { // Registered user's comment
      if (currentUserId === comment.user_id) {
        if (window.confirm('정말로 댓글을 삭제하시겠습니까?')) {
          await performDelete(comment.id);
        }
      } else {
        alert('자신이 작성한 댓글만 삭제할 수 있습니다.');
      }
    }
  };

  return (
    <div className="mt-8 p-4 bg-white rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">댓글</h2>
      <div className="mb-4">
        {isGuest && (
          <div className="flex gap-4 mb-2">
            <input
              type="text"
              placeholder="이름"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              className="w-1/6 p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="password"
              placeholder="비밀번호 (댓글 작성 시 필요)"
              value={guestPassword}
              onChange={(e) => setGuestPassword(e.target.value)}
              className="w-1/6 p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}
        <div className="flex items-stretch gap-2">
          <textarea
            className="flex-grow p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows="3"
            placeholder="댓글을 작성하세요..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
          ></textarea>
          <div className="flex flex-col gap-2">
            <input 
              type="file"
              id="comment-image-upload"
              accept="image/*"
              multiple
              onChange={handleFileChange}
              className="hidden"
            />
            <label htmlFor="comment-image-upload" className="cursor-pointer px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 text-center">
              사진 추가
            </label>
            <button
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-400"
              onClick={handlePostComment}
              disabled={newComment.trim() === '' && imageFiles.length === 0}
            >
              작성
            </button>
          </div>
        </div>
        {imageFiles.length > 0 && (
          <div className="mt-2 grid grid-cols-5 gap-2">
            {imageFiles.map((file, index) => (
              <div key={index} className="relative aspect-square">
                <img 
                  src={URL.createObjectURL(file)}
                  alt={`Preview ${index}`}
                  className="w-full h-full object-cover rounded-md"
                />
                <button 
                  onClick={() => setImageFiles(prev => prev.filter((_, i) => i !== index))}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold"
                >
                  X
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="space-y-4">
        {comments.length === 0 ? (
          <p className="text-gray-500">아직 댓글이 없습니다.</p>
        ) : (
          comments.map((comment) => {
            const isGuestComment = !!comment.password_hash;
            const isUserAuthenticated = !!currentUserId && !isGuest;
            const canOwnerManage = isOwner;
            const canAuthUserManageGuestComment = isUserAuthenticated && isGuestComment;
            const canGuestManage = isGuest && isGuestComment;
            const canUserManageOwnComment = !isGuestComment && currentUserId === comment.user_id;

            const canDelete = canOwnerManage || canAuthUserManageGuestComment || canUserManageOwnComment || canGuestManage;
            const canEdit = canOwnerManage || canUserManageOwnComment || canGuestManage;

            const isEditing = editingCommentId === comment.id;

            return (
              <div key={comment.id} className="p-3 bg-gray-50 rounded-md">
                <div className="flex justify-between items-start">
                  <p className="text-sm font-semibold text-gray-600">{comment.user_id ? '총무' : (comment.guest_name || '사용자')}</p>
                  <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-2">
                      {canEdit && !isEditing && (
                        <button 
                          onClick={() => startEditing(comment)}
                          className="text-xs text-blue-500 hover:text-blue-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                          disabled={canGuestManage && !guestPasswords[comment.id]}
                        >
                          수정
                        </button>
                      )}
                      {canDelete && !isEditing && (
                        <button 
                          onClick={() => handleDeleteComment(comment)}
                          className="text-xs text-red-500 hover:text-red-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                          disabled={canGuestManage && !guestPasswords[comment.id]}
                        >
                          삭제
                        </button>
                      )}
                    </div>
                    {canGuestManage && !isEditing && (
                      <div className="mt-1">
                        <input 
                          type="password"
                          placeholder="비밀번호"
                          value={guestPasswords[comment.id] || ''}
                          onChange={(e) => handlePasswordChange(comment.id, e.target.value)}
                          className="p-1 text-xs border border-gray-300 rounded-md w-28"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {isEditing ? (
                  <div className="mt-2">
                    <textarea
                      value={editingContent}
                      onChange={(e) => setEditingContent(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md"
                    />
                    <div className="flex justify-end gap-2 mt-2">
                      <button onClick={cancelEditing} className="text-sm text-gray-600">취소</button>
                      <button 
                        onClick={() => handleUpdateComment(comment.id)} 
                        className="text-sm text-blue-600 font-bold disabled:text-gray-400 disabled:cursor-not-allowed"
                        disabled={canGuestManage && !guestPasswords[comment.id]}
                      >
                        저장
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-gray-800 mt-1 whitespace-pre-wrap">{comment.content}</p>
                    {comment.image_url && comment.image_url.length > 0 && (
                      <div className="mt-2 grid grid-cols-5 gap-2">
                        {comment.image_url.map((url, index) => (
                          <div key={index} className="relative aspect-square cursor-pointer" onClick={() => setModalImageUrl(url)}>
                            <img src={url} alt={`Attachment ${index + 1}`} className="w-full h-full object-cover rounded-md" />
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}

                <p className="text-xs text-gray-400 mt-2">
                  {new Date(comment.created_at).toLocaleString()}
                </p>
              </div>
            );
          })
        )}
      </div>

      {modalImageUrl && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50"
          onClick={() => setModalImageUrl(null)}
        >
          <img 
            src={modalImageUrl} 
            alt="Enlarged view" 
            className="max-w-[90vw] max-h-[90vh] object-contain"
            onClick={(e) => e.stopPropagation()} // Prevents modal from closing when clicking the image
          />
          <button 
            className="absolute top-4 right-4 text-white text-3xl font-bold"
            onClick={() => setModalImageUrl(null)}
          >
            &times;
          </button>
        </div>
      )}
    </div>
  );
};

export default CommentSection;

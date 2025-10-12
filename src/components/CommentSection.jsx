import React, { useState, useEffect, useCallback } from 'react';
import imageCompression from 'browser-image-compression';
import { supabase } from '../supabaseClient';

const buildCommentTree = (comments) => {
  const commentMap = {};
  const commentTree = [];
  comments.forEach(comment => {
    commentMap[comment.id] = { ...comment, children: [] };
  });
  comments.forEach(comment => {
    if (comment.parent_comment_id && commentMap[comment.parent_comment_id]) {
      commentMap[comment.parent_comment_id].children.push(commentMap[comment.id]);
    } else {
      commentTree.push(commentMap[comment.id]);
    }
  });
  return commentTree;
};

// A recursive function to determine if a comment or any of its children are visible.
const isCommentVisible = (comment) => {
  // If the comment itself is not deleted, it's visible.
  if (!comment.is_deleted) return true;
  // If the comment is deleted, it's only visible if at least one of its children is visible.
  if (comment.children && comment.children.length > 0) {
    return comment.children.some(isCommentVisible);
  }
  // If it's deleted and has no children, it's not visible.
  return false;
};

const Comment = ({ comment, level, commentProps }) => {
  const {
    isOwner,
    currentUserId,
    isGuest,
    editingCommentId,
    replyingTo,
    guestPasswords,
    editingContent,
    replyContent,
    replyImageFiles,
    startEditing,
    handleDeleteComment,
    setReplyingTo,
    handleUpdateComment,
    setEditingContent,
    setEditingCommentId,
    handlePasswordChange,
    handlePostComment,
    setReplyContent,
    setReplyImageFiles,
    setModalImageUrl,
    handleFileChange
  } = commentProps;

  if (!isCommentVisible(comment)) {
    return null;
  }

  const isGuestComment = !!comment.password_hash;
  const canOwnerManage = isOwner;
  const canUserManageOwnComment = !isGuestComment && currentUserId === comment.user_id;
  const canGuestManage = isGuest && isGuestComment;
  const canDelete = canOwnerManage || canUserManageOwnComment || canGuestManage;
  const canEdit = canOwnerManage || canUserManageOwnComment || canGuestManage;
  const isEditing = editingCommentId === comment.id;
  const isReplying = replyingTo === comment.id;

  const indentationClasses = ['ml-0', 'ml-4', 'ml-8', 'ml-12', 'ml-16', 'ml-20'];
  const indentationClass = indentationClasses[level] || indentationClasses[indentationClasses.length - 1];

  const cancelEditing = () => setEditingCommentId(null);
  const cancelReply = () => {
    setReplyingTo(null);
    setReplyContent('');
    setReplyImageFiles([]);
  };

  if (comment.is_deleted) {
    return (
      <div className={`${indentationClass} p-3 rounded-md`}>
        <p className="text-gray-500 italic">삭제된 댓글입니다.</p>
        {comment.children && comment.children.length > 0 && (
          <div className="mt-4 space-y-4 border-l-2 border-gray-200 pl-4">
            {comment.children.map(child => <Comment key={child.id} comment={child} level={level + 1} commentProps={commentProps} />)}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`${indentationClass} p-3 bg-gray-50 rounded-md`}>
      <div className="flex justify-between items-start">
        <p className="text-sm font-semibold text-gray-600">{comment.guest_name || '사용자'}</p>
        <div className="flex items-center gap-2">
          {!isEditing && <button onClick={() => setReplyingTo(comment.id)} className="text-xs text-gray-600 hover:text-blue-700">답글</button>}
          {canEdit && !isEditing && <button onClick={() => startEditing(comment)} className="text-xs text-blue-500 hover:text-blue-700" disabled={canGuestManage && !guestPasswords[comment.id]}>수정</button>}
          {canDelete && !isEditing && <button onClick={() => handleDeleteComment(comment)} className="text-xs text-red-500 hover:text-red-700" disabled={canGuestManage && !guestPasswords[comment.id]}>삭제</button>}
        </div>
      </div>
      {canGuestManage && !isEditing && (
        <div className="mt-1">
          <input type="password" placeholder="비밀번호" value={guestPasswords[comment.id] || ''} onChange={(e) => handlePasswordChange(comment.id, e.target.value)} className="p-1 text-xs border rounded w-28" />
        </div>
      )}

      {isEditing ? (
        <div className="mt-2">
          <textarea value={editingContent} onChange={(e) => setEditingContent(e.target.value)} className="w-full p-2 border rounded" autoFocus />
          <div className="flex justify-end gap-2 mt-2">
            <button onClick={cancelEditing} className="text-sm">취소</button>
            <button onClick={() => handleUpdateComment(comment.id)} className="text-sm font-bold text-blue-600" disabled={canGuestManage && !guestPasswords[comment.id]}>저장</button>
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

      <p className="text-xs text-gray-400 mt-2">{new Date(comment.created_at).toLocaleString()}</p>

      {isReplying && (
        <div className="mt-4 ml-4 p-4 border-l-2">
          <textarea className="w-full p-2 border rounded" rows="2" placeholder={`${comment.guest_name || '사용자'}에게 답글...`} value={replyContent} onChange={(e) => setReplyContent(e.target.value)} autoFocus />
          <div className="flex items-center justify-between mt-2">
            <div>
              <input type="file" id={`reply-image-upload-${comment.id}`} accept="image/*" multiple onChange={(e) => handleFileChange(e, true)} className="hidden" />
              <label htmlFor={`reply-image-upload-${comment.id}`} className="cursor-pointer text-sm text-gray-600">사진 추가</label>
            </div>
            <div className="flex gap-2">
              <button onClick={cancelReply} className="text-sm">취소</button>
              <button onClick={() => handlePostComment(comment.id)} className="text-sm font-bold text-blue-600" disabled={!replyContent.trim() && replyImageFiles.length === 0}>답글 작성</button>
            </div>
          </div>
          {replyImageFiles.length > 0 && (
            <div className="mt-2 grid grid-cols-5 gap-2">
              {replyImageFiles.map((file, index) => (
                <div key={index} className="relative aspect-square">
                  <img src={URL.createObjectURL(file)} alt={`Reply Preview ${index}`} className="w-full h-full object-cover rounded" />
                  <button onClick={() => setReplyImageFiles(p => p.filter((_, i) => i !== index))} className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">X</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {comment.children && comment.children.length > 0 && (
        <div className="mt-4 space-y-4 border-l-2 border-gray-200 pl-4">
          {comment.children.map(child => <Comment key={child.id} comment={child} level={level + 1} commentProps={commentProps} />)}
        </div>
      )}
    </div>
  );
};

const CommentSection = ({ settlementId, isGuest, isOwner, showModal }) => {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [imageFiles, setImageFiles] = useState([]);
  const [guestName, setGuestName] = useState('');
  const [guestPassword, setGuestPassword] = useState('');
  const [currentUserId, setCurrentUserId] = useState(null);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingContent, setEditingContent] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyContent, setReplyContent] = useState('');
  const [replyImageFiles, setReplyImageFiles] = useState([]);
  const [modalImageUrl, setModalImageUrl] = useState(null);
  const [guestPasswords, setGuestPasswords] = useState({});

  const fetchComments = useCallback(async () => {
    if (!settlementId) return;
    const { data, error } = await supabase
      .from('comments')
      .select('*')
      .eq('settlement_id', settlementId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching comments:', error);
    } else {
      const commentTree = buildCommentTree(data);
      setComments(commentTree);
    }
  }, [settlementId]);

  useEffect(() => {
    const setup = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id);
      fetchComments();
    };
    setup();

    const subscription = supabase
      .channel(`comments-for-${settlementId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments', filter: `settlement_id=eq.${settlementId}` },
        () => { fetchComments(); }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [settlementId, fetchComments]);

  const handleFileChange = (e, isReply = false) => {
    const files = Array.from(e.target.files);
    const currentFiles = isReply ? replyImageFiles : imageFiles;
    const setFiles = isReply ? setReplyImageFiles : setImageFiles;

    if (files.length + currentFiles.length > 10) {
      showModal({ title: '알림', content: '이미지는 최대 10장까지 첨부할 수 있습니다.' });
      return;
    }
    setFiles(prevFiles => [...prevFiles, ...files]);
  };

  const uploadImages = async (files) => {
    if (files.length === 0) return [];
    const uploadPromises = files.map(async (file) => {
      const options = { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true, fileType: 'image/webp' };
      const compressedFile = await imageCompression(file, options);
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.webp`;
      const filePath = `public/comments/${settlementId}/${fileName}`;
      const { error: uploadError } = await supabase.storage.from('comment_images').upload(filePath, compressedFile);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('comment_images').getPublicUrl(filePath);
      return urlData.publicUrl;
    });
    try {
      return await Promise.all(uploadPromises);
    } catch (error) {
      console.error('Image upload failed:', error);
      showModal({ title: '오류', content: '일부 또는 전체 이미지 업로드에 실패했습니다.' });
      throw error;
    }
  };

  const handlePostComment = async (parentId = null) => {
    const isReply = parentId !== null;
    const content = isReply ? replyContent : newComment;
    const files = isReply ? replyImageFiles : imageFiles;

    if ((content.trim() === '' && files.length === 0) || !settlementId) return;

    let uploadedImageUrls;
    try {
      uploadedImageUrls = await uploadImages(files);
    } catch { return; }

    const commentData = { content, settlement_id: settlementId, image_url: uploadedImageUrls, parent_comment_id: parentId };

    if (isGuest) {
      if (guestName.trim() === '' || guestPassword.trim() === '') {
        showModal({ title: '알림', content: '이름과 비밀번호를 모두 입력해주세요.' });
        return;
      }
      const { error } = await supabase.rpc('add_guest_comment', { settlement_id_arg: settlementId, guest_name_arg: guestName, password_arg: guestPassword, content_arg: content, image_url_arg: uploadedImageUrls, parent_comment_id_arg: parentId });
      if (error) {
        showModal({ title: '오류', content: '댓글 작성에 실패했습니다.' });
      } else {
        if (isReply) {
          setReplyingTo(null);
          setReplyContent('');
          setReplyImageFiles([]);
        } else {
          setNewComment('');
          setImageFiles([]);
        }
      }
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase.from('comments').insert([{ ...commentData, user_id: user.id, guest_name: '총무' }]);
      if (error) {
        showModal({ title: '오류', content: '댓글 작성에 실패했습니다.' });
      } else {
        if (isReply) {
          setReplyingTo(null);
          setReplyContent('');
          setReplyImageFiles([]);
        } else {
          setNewComment('');
          setImageFiles([]);
        }
      }
    }
  };

  const handleUpdateComment = async (commentId) => {
    const flatComments = comments.flatMap(c => [c, ...(c.children || [])]);
    const commentToEdit = flatComments.find(c => c.id === commentId);
    if (!commentToEdit) return;

    const isGuestComment = !!commentToEdit.password_hash;
    if (isGuestComment) {
      const password = guestPasswords[commentId] || '';
      if (!password) { showModal({ title: '알림', content: '비밀번호를 입력해주세요.' }); return; }
      const { data, error } = await supabase.rpc('update_guest_comment', { comment_id_arg: commentId, password_arg: password, new_content_arg: editingContent });
      if (error || !data) { showModal({ title: '오류', content: '비밀번호가 일치하지 않거나 수정에 실패했습니다.' }); }
      else { setEditingCommentId(null); }
    } else {
      const { error } = await supabase.from('comments').update({ content: editingContent }).eq('id', commentId);
      if (error) { showModal({ title: '오류', content: '댓글 수정에 실패했습니다.' }); }
      else { setEditingCommentId(null); }
    }
  };

  const startEditing = async (comment) => {
    const isGuestComment = !!comment.password_hash;
    if (isGuestComment) {
      const password = guestPasswords[comment.id] || '';
      if (!password) { showModal({ title: '알림', content: '수정을 위해 비밀번호를 입력해주세요.' }); return; }
      const { data, error } = await supabase.rpc('verify_guest_password', { comment_id_arg: comment.id, password_arg: password });
      if (error || !data) { showModal({ title: '오류', content: '비밀번호가 일치하지 않습니다.' }); return; }
    }
    setEditingCommentId(comment.id);
    setEditingContent(comment.content);
  };

  const performDelete = async (commentId) => {
    const { error } = await supabase
      .from('comments')
      .update({ 
        is_deleted: true, 
        content: '삭제된 댓글입니다.', 
        guest_name: '삭제된 사용자',
        image_url: [] 
      })
      .eq('id', commentId);
    if (error) showModal({ title: '오류', content: '댓글 삭제 중 오류가 발생했습니다.' });
  };

  const handleDeleteComment = async (comment) => {
    const isGuestComment = !!comment.password_hash;
    if (isOwner) {
      showModal({ title: '댓글 삭제', content: '관리자 권한으로 댓글을 삭제하시겠습니까?', onConfirm: () => performDelete(comment.id) });
      return;
    }
    if (isGuestComment) {
      const password = guestPasswords[comment.id] || '';
      if (!password) { showModal({ title: '알림', content: '삭제를 위해 비밀번호를 입력해주세요.' }); return; }
      const { data, error } = await supabase.rpc('soft_delete_guest_comment', { comment_id_arg: comment.id, password_arg: password });
      if (error || !data) { showModal({ title: '오류', content: '비밀번호가 일치하지 않거나 삭제에 실패했습니다.' }); }
    } else {
      if (currentUserId === comment.user_id) {
        showModal({ title: '댓글 삭제', content: '정말로 댓글을 삭제하시겠습니까?', onConfirm: () => performDelete(comment.id) });
      } else {
        showModal({ title: '권한 없음', content: '자신이 작성한 댓글만 삭제할 수 있습니다.' });
      }
    }
  };

  const handlePasswordChange = (commentId, password) => {
    setGuestPasswords(prev => ({ ...prev, [commentId]: password }));
  };

  const commentProps = {
    isOwner,
    currentUserId,
    isGuest,
    editingCommentId,
    replyingTo,
    guestPasswords,
    editingContent,
    replyContent,
    replyImageFiles,
    startEditing,
    handleDeleteComment,
    setReplyingTo,
    handleUpdateComment,
    setEditingContent,
    setEditingCommentId,
    handlePasswordChange,
    handlePostComment,
    setReplyContent,
    setReplyImageFiles,
    setModalImageUrl,
    handleFileChange
  };

  return (
    <div className="mt-8 p-4 bg-white rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">댓글</h2>
      <div className="mb-4">
        {isGuest && (
          <div className="flex gap-4 mb-2">
            <input type="text" placeholder="이름" value={guestName} onChange={(e) => setGuestName(e.target.value)} className="w-1/6 p-2 border rounded" />
            <input type="password" placeholder="비밀번호" value={guestPassword} onChange={(e) => setGuestPassword(e.target.value)} className="w-1/6 p-2 border rounded" />
          </div>
        )}
        <div className="flex items-stretch gap-2">
          <textarea className="flex-grow p-2 border rounded" rows="3" placeholder="댓글을 작성하세요..." value={newComment} onChange={(e) => setNewComment(e.target.value)} />
          <div className="flex flex-col gap-2">
            <input type="file" id="comment-image-upload" accept="image/*" multiple onChange={(e) => handleFileChange(e, false)} className="hidden" />
            <label htmlFor="comment-image-upload" className="cursor-pointer px-4 py-2 bg-gray-200 rounded text-center">사진 추가</label>
            <button className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-400" onClick={() => handlePostComment(null)} disabled={!newComment.trim() && imageFiles.length === 0}>작성</button>
          </div>
        </div>
        {imageFiles.length > 0 && (
          <div className="mt-2 grid grid-cols-5 gap-2">
            {imageFiles.map((file, index) => (
              <div key={index} className="relative aspect-square">
                <img src={URL.createObjectURL(file)} alt={`Preview ${index}`} className="w-full h-full object-cover rounded" />
                <button onClick={() => setImageFiles(p => p.filter((_, i) => i !== index))} className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">X</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4">
        {comments.length === 0 ? (
          <p className="text-gray-500">아직 댓글이 없습니다.</p>
        ) : (
          comments.map((comment) => <Comment key={comment.id} comment={comment} level={0} commentProps={commentProps} />)
        )}
      </div>

      {modalImageUrl && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50" onClick={() => setModalImageUrl(null)}>
          <img src={modalImageUrl} alt="Enlarged view" className="max-w-[90vw] max-h-[90vh] object-contain" onClick={(e) => e.stopPropagation()} />
          <button className="absolute top-4 right-4 text-white text-3xl" onClick={() => setModalImageUrl(null)}>&times;</button>
        </div>
      )}
    </div>
  );
};

export default CommentSection;

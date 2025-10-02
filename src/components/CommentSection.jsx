import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const CommentSection = ({ settlementId, isGuest, isOwner }) => {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestPassword, setGuestPassword] = useState('');
  const [currentUserId, setCurrentUserId] = useState(null);

  useEffect(() => {
    if (!settlementId) return;

    const setup = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id);

      const { data, error } = await supabase
        .from('comments')
        .select('*')
        .eq('settlement_id', settlementId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching comments:', error);
      } else {
        setComments(data);
      }
    };

    setup();

    // Real-time subscription for new comments
    const subscription = supabase
      .channel('comments')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'comments', filter: `settlement_id=eq.${settlementId}` },
        (payload) => {
          setComments((prevComments) => [payload.new, ...prevComments]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [settlementId]);

  const handlePostComment = async () => {
    if (newComment.trim() === '' || !settlementId) return;

    if (isGuest) {
      if (guestName.trim() === '' || guestPassword.trim() === '') {
        alert('이름과 비밀번호를 모두 입력해주세요.');
        return;
      }
      const { error } = await supabase.rpc('add_guest_comment', {
        settlement_id_arg: settlementId,
        guest_name_arg: guestName,
        password_arg: guestPassword,
        content_arg: newComment,
      });

      if (error) {
        console.error('Error posting guest comment:', error);
      } else {
        setNewComment('');
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
            content: newComment,
            settlement_id: settlementId,
            user_id: user.id,
            guest_name: user.email, // For regular users, we can use their email as a display name
          }
        ])
        .select();

      if (error) {
        console.error('Error posting comment:', error);
      } else {
        setNewComment('');
      }
    }
  };

  const handleDeleteComment = async (comment) => {
    let password = '';
    // It's a guest comment if it has a password hash.
    if (comment.password_hash) {
      password = prompt('게스트 댓글을 삭제하려면 비밀번호를 입력하세요:');
      if (password === null) return; // User cancelled the prompt
    }

    const { data, error } = await supabase.rpc('delete_comment', { 
      comment_id_arg: comment.id,
      password_arg: password
    });

    if (error) {
      console.error('Error deleting comment:', error);
      alert('댓글 삭제 중 오류가 발생했습니다.');
    } else if (data && data.includes('permission')) {
      alert(data); // Show permission denied message from the function
    } else {
      // Remove the comment from the local state to update the UI instantly
      setComments(comments.filter(c => c.id !== comment.id));
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
              className="w-1/3 p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="password"
              placeholder="비밀번호 (수정/삭제 시 필요)"
              value={guestPassword}
              onChange={(e) => setGuestPassword(e.target.value)}
              className="w-1/3 p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}
        <div className="flex items-start gap-2">
          <textarea
            className="flex-grow p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows="3"
            placeholder="댓글을 작성하세요..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
          ></textarea>
          <button
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            onClick={handlePostComment}
          >
            작성
          </button>
        </div>
      </div>
      <div className="space-y-4">
        {comments.length === 0 ? (
          <p className="text-gray-500">아직 댓글이 없습니다.</p>
        ) : (
          comments.map((comment) => {
            const canDelete = isOwner || currentUserId === comment.user_id || comment.password_hash;
            return (
              <div key={comment.id} className="p-3 bg-gray-50 rounded-md">
                <div className="flex justify-between items-center">
                  <p className="text-sm font-semibold text-gray-600">{comment.guest_name || '사용자'}</p>
                  {canDelete && (
                    <button 
                      onClick={() => handleDeleteComment(comment)}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      삭제
                    </button>
                  )}
                </div>
                <p className="text-gray-800 mt-1">{comment.content}</p>
                <p className="text-xs text-gray-400 mt-2">
                  {new Date(comment.created_at).toLocaleString()}
                </p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default CommentSection;

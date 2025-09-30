import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const CommentSection = ({ settlementId }) => {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');

  useEffect(() => {
    if (!settlementId) return;

    const fetchComments = async () => {
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

    fetchComments();

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

    const { data, error } = await supabase
      .from('comments')
      .insert([
        { content: newComment, settlement_id: settlementId }
      ])
      .select();

    if (error) {
      console.error('Error posting comment:', error);
    } else {
      setNewComment('');
    }
  };

  return (
    <div className="mt-8 p-4 bg-white rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">댓글</h2>
      <div className="mb-4">
        <textarea
          className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows="3"
          placeholder="댓글을 작성하세요..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
        ></textarea>
        <button
          className="mt-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          onClick={handlePostComment}
        >
          작성
        </button>
      </div>
      <div className="space-y-4">
        {comments.length === 0 ? (
          <p className="text-gray-500">아직 댓글이 없습니다.</p>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="p-3 bg-gray-50 rounded-md">
              <p className="text-gray-800">{comment.content}</p>
              <p className="text-xs text-gray-400 mt-1">
                {new Date(comment.created_at).toLocaleString()}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default CommentSection;

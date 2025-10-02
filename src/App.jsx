import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import ExpenseTable from './components/ExpenseTable';
import CommentSection from './components/CommentSection';
import Login from './components/Login';

function App() {
  const [session, setSession] = useState(null);
  const [settlementId, setSettlementId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [title, setTitle] = useState('Aloha RU 정산 시스템');
  const [subtitle, setSubtitle] = useState('Gently Split the Bill FAST');

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setIsGuest(session?.user?.id === import.meta.env.VITE_GUEST_USER_ID);
      setIsOwner(session?.user?.id === import.meta.env.VITE_OWNER_USER_ID);
      setLoading(false);
    };

    getSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setIsGuest(session?.user?.id === import.meta.env.VITE_GUEST_USER_ID);
        setIsOwner(session?.user?.id === import.meta.env.VITE_OWNER_USER_ID);
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };
  
  if (loading) {
    return null; // or a loading spinner
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      {!session ? (
        <Login />
      ) : (
        <>
          <header className="flex justify-between items-center text-center mb-8">
            <div></div> {/* Empty div for spacing */}
            <div className="flex flex-col items-center">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                readOnly={isGuest}
                className="text-3xl sm:text-4xl font-bold text-gray-800 text-center bg-transparent w-full focus:outline-none focus:ring-2 focus:ring-blue-300 rounded-md"
              />
              <input
                type="text"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                readOnly={isGuest}
                className="text-gray-500 mt-2 text-center bg-transparent w-full focus:outline-none focus:ring-2 focus:ring-blue-300 rounded-md"
              />
            </div>
            <button 
              onClick={handleLogout} 
              className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
            >
              로그아웃
            </button>
          </header>

          <main>
            <div className="inline-block min-w-full">
              <ExpenseTable 
                onSettlementIdChange={setSettlementId} 
                isGuest={isGuest} 
                key={session.user.id}
                title={title}
                setTitle={setTitle}
                subtitle={subtitle}
                setSubtitle={setSubtitle}
              />
              {settlementId && <CommentSection settlementId={settlementId} isGuest={isGuest} isOwner={isOwner} />}
            </div>
          </main>
        </>
      )}
    </div>
  );
}

export default App;
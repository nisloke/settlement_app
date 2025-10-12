import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from './supabaseClient';
import ExpenseTable from './components/ExpenseTable';
import CommentSection from './components/CommentSection';
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import Modal from './components/Modal';

function App() {
  const appRef = useRef(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [modalState, setModalState] = useState({ isOpen: false, title: '', content: null, onConfirm: null });
  const [commentRefreshKey, setCommentRefreshKey] = useState(0);
  const profileUsernameRef = useRef('');

  // Data states
  const [settlementId, setSettlementId] = useState(null);
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [participants, setParticipants] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [personalDeductionItems, setPersonalDeductionItems] = useState({});
  const [isArchived, setIsArchived] = useState(false);
  const [settlementList, setSettlementList] = useState([]);

  const getTargetUserId = useCallback((user) => {
    const isGuestUser = user?.id === import.meta.env.VITE_GUEST_USER_ID;
    return isGuestUser ? import.meta.env.VITE_OWNER_USER_ID : user?.id;
  }, []);

  const fetchSettlementList = useCallback(async (user) => {
    const targetUserId = getTargetUserId(user);
    if (!targetUserId) {
      setSettlementList([]);
      return;
    }
    const { data, error } = await supabase
        .from('settlements')
        .select('id, data, created_at, status')
        .eq('user_id', targetUserId)
        .not('status', 'eq', 'deleted')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching settlement list:', error);
        setSettlementList([]);
    } else {
        setSettlementList(data || []);
    }
  }, [getTargetUserId]);

  const loadSettlementData = useCallback(async (id) => {
    if (!id) {
      setSettlementId(null);
      return;
    }
    const { data, error } = await supabase.from('settlements').select('id, data, status').eq('id', id).single();

    if (error) {
      console.error('Error fetching selected settlement:', error);
      setSettlementId(null);
    } else if (data) {
      setSettlementId(data.id);
      const parsedData = data.data || {};
      setTitle(parsedData.title || '제목 없음');
      setSubtitle(parsedData.subtitle || '');
      setParticipants(parsedData.participants || []);
      setExpenses(parsedData.expenses || []);
      setPersonalDeductionItems(parsedData.personalDeductionItems || {});
      setIsArchived(data.status === 'archived');

      if (data.status === 'active') {
        showModal({ title: '주의', content: '정산중입니다. 입금 금지!' });
      }
    }
  }, []);

  const createNewSettlement = useCallback(async () => {
    const user = session?.user;

    if (!user || isGuest) {
      return;
    }

    const targetUserId = getTargetUserId(user);
    
    const initialData = { title: '새로운 정산', subtitle: 'Gently Split the Bill FAST', participants: [{ id: 1, name: '참석자 1' }], expenses: [{ id: 1, itemName: '저녁 식사', totalCost: 100000, attendees: { 1: true } }], personalDeductionItems: {} };
    const { data: newSettlement, error: createError } = await supabase
        .from('settlements')
        .insert({ data: initialData, user_id: targetUserId, status: 'active' })
        .select()
        .single();

    if (createError) {
        console.error('Error creating new settlement:', createError);
        alert('새로운 정산 시트를 만드는 데 실패했습니다.');
    } else if (newSettlement) {
        setSettlementList(list => [newSettlement, ...list].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
        await loadSettlementData(newSettlement.id);
        setIsSidebarOpen(false);
    }
  }, [session, getTargetUserId, isGuest, loadSettlementData, setSettlementList, setIsSidebarOpen]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const appElement = appRef.current;
    if (!appElement) return;

    const setAppHeight = () => {
      // Set height based on the visual viewport to handle mobile keyboards correctly
      appElement.style.height = `${window.innerHeight}px`;
    };

    setAppHeight();

    // Adjust height on resize (e.g., orientation change)
    window.addEventListener('resize', setAppHeight);

    return () => {
      window.removeEventListener('resize', setAppHeight);
    };
  }, []);

  useEffect(() => {
    const loadUserData = async () => {
      if (session) {
        setLoading(true);
        const user = session.user;
        const isGuestUser = user.id === import.meta.env.VITE_GUEST_USER_ID;
        setIsGuest(isGuestUser);
        setIsOwner(user.id === import.meta.env.VITE_OWNER_USER_ID);

        await fetchSettlementList(user);

        const targetUserId = getTargetUserId(user);
        const { data: activeSettlements, error: activeError } = await supabase
          .from('settlements')
          .select('id')
          .eq('user_id', targetUserId)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1);

        const activeSettlement = activeSettlements ? activeSettlements[0] : null;
        
        if (activeError) {
          console.error("Error fetching active settlement:", activeError);
        }

        
        if (activeSettlement) {
          await loadSettlementData(activeSettlement.id);
        } else {
          const { data: latestSettlement } = await supabase
            .from('settlements')
            .select('id')
            .eq('user_id', targetUserId)
            .not('status', 'eq', 'deleted')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
          
          if (latestSettlement) {
            await loadSettlementData(latestSettlement.id);
          } else if (!isGuestUser) {
            await createNewSettlement();
          }
        }
        setLoading(false);
      } else {
        setSettlementId(null);
        setTitle('');
        setSubtitle('');
        setParticipants([]);
        setExpenses([]);
        setPersonalDeductionItems({});
        setSettlementList([]);
      }
    };

    loadUserData();
  }, [session, fetchSettlementList, getTargetUserId, loadSettlementData, createNewSettlement]);

  const showModal = ({ title, content, onConfirm = null }) => {
    setModalState({ isOpen: true, title, content, onConfirm });
  };

  const closeModal = () => {
    setModalState({ isOpen: false, title: '', content: null, onConfirm: null });
  };

  const handleLogout = async () => { await supabase.auth.signOut(); };
  
  const handleSelectSettlement = (id) => { 
    loadSettlementData(id); 
    setIsSidebarOpen(false);
  };

  const handleUpdateProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const newUsername = profileUsernameRef.current;

    if (newUsername.length < 2) {
      showModal({ title: '알림', content: '사용자 이름은 2자 이상이어야 합니다.' });
      return;
    }

    const { error } = await supabase.from('profiles').update({ username: newUsername }).eq('id', user.id);
    
    closeModal();

    setTimeout(() => {
      if (error) {
        showModal({ title: '오류', content: `프로필 업데이트 실패: ${error.message}` });
      } else {
        showModal({ title: '성공', content: '사용자 이름이 성공적으로 저장되었습니다.' });
        setCommentRefreshKey(k => k + 1); // Trigger comment refresh
      }
    }, 200);
  };

  const handleOpenProfileModal = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .single();

    if (error) {
      showModal({ title: '오류', content: '프로필 정보를 불러오는 데 실패했습니다.' });
      return;
    }

    profileUsernameRef.current = profile.username || '';

    showModal({
      title: '사용자 이름 변경',
      content: (
        <input 
          type="text"
          placeholder="이름을 입력하세요"
          defaultValue={profileUsernameRef.current}
          onChange={(e) => profileUsernameRef.current = e.target.value}
          className="w-full p-2 border rounded-md text-sm"
          autoFocus
        />
      ),
      onConfirm: handleUpdateProfile
    });
  };

  const handleCompleteSettlement = async () => {
    if (!settlementId || isGuest || isArchived) return;

    const dataToSave = { title, subtitle, participants, expenses, personalDeductionItems };
    const { error: saveError } = await supabase.from('settlements').update({ data: dataToSave }).eq('id', settlementId);

    if (saveError) {
        showModal({ title: '오류', content: '데이터 저장 중 오류가 발생하여 정산을 완료할 수 없습니다.' });
        return;
    }

    const { data: updatedSettlement, error: updateError } = await supabase.from('settlements').update({ status: 'archived' }).eq('id', settlementId).select().single();

    if (updateError) {
        showModal({ title: '오류', content: '정산 완료 처리 중 오류가 발생했습니다.' });
        console.error('Error archiving settlement:', updateError);
    } else {
        showModal({ title: '완료', content: '정산이 완료되어 보관되었습니다.' });
        setSettlementList(list => list.map(s => s.id === settlementId ? updatedSettlement : s).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
        await loadSettlementData(settlementId);
    }
  };

  const handleReactivateSettlement = async (idToReactivate) => {
    showModal({
      title: '정산 재활성화',
      content: '보관된 정산을 다시 수정하시겠습니까?',
      onConfirm: async () => {
        const { error: reactivateError } = await supabase
          .from('settlements')
          .update({ status: 'active' })
          .eq('id', idToReactivate)
          .select()
          .single();

        if (reactivateError) {
          console.error('Error reactivating settlement:', reactivateError);
          showModal({ title: '오류', content: '정산을 다시 활성화하는 중 오류가 발생했습니다.' });
          return;
        }

        showModal({ title: '성공', content: '정산이 다시 활성화되어 수정을 계속할 수 있습니다.' });
        await fetchSettlementList(session?.user);
        await loadSettlementData(idToReactivate);
      }
    });
  };

  const handleDeleteSettlement = async (idToDelete) => {
    showModal({
      title: '정산 내역 삭제',
      content: '정말로 이 정산 내역을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.',
      onConfirm: async () => {
        const { error } = await supabase.from('settlements').update({ status: 'deleted' }).eq('id', idToDelete);
        if (error) {
            console.error('Error (soft) deleting settlement:', error);
            showModal({ title: '오류', content: '삭제 중 오류가 발생했습니다.' });
        } else {
            showModal({ title: '삭제 완료', content: '정산 내역이 삭제되었습니다.' });
            setSettlementList(list => list.filter(s => s.id !== idToDelete));
            if (settlementId === idToDelete) {
                setSettlementId(null);
            }
        }
      }
    });
  };

  if (loading) {
    return <div className="w-full h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div ref={appRef} className="bg-gray-100 overflow-y-auto">
      <Modal 
        isOpen={modalState.isOpen}
        onClose={closeModal}
        title={modalState.title}
        onConfirm={modalState.onConfirm}
      >
        {modalState.content}
      </Modal>
      {!session ? (
        <div className="w-full"><Login /></div>
      ) : (
        <>
          <Sidebar 
            settlements={settlementList}
            onSelectSettlement={handleSelectSettlement} 
            onDeleteSettlement={handleDeleteSettlement}
            createNewSettlement={createNewSettlement}
            currentSettlementId={settlementId}
            isGuest={isGuest}
            isOpen={isSidebarOpen}
            onClose={() => setIsSidebarOpen(false)}
            onOpenProfileModal={handleOpenProfileModal}
            onLogout={handleLogout}
          />
          <div className="w-full p-4 sm:p-6 lg:p-8">
            <header className="flex items-center justify-between w-full mb-6">
              <button onClick={() => setIsSidebarOpen(true)} className="bg-gray-200 hover:bg-gray-300 p-2 rounded-md">
                <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
              </button>
            </header>

            <div className="text-center mb-8">
              <div className="flex flex-col items-center max-w-2xl mx-auto">
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} readOnly={isGuest || isArchived} className="text-3xl sm:text-4xl font-bold text-gray-800 text-center bg-transparent w-full focus:outline-none focus:ring-2 focus:ring-blue-300 rounded-md read-only:bg-transparent read-only:ring-0" />
                <input type="text" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} readOnly={isGuest || isArchived} className="text-gray-500 mt-2 text-center bg-transparent w-full focus:outline-none focus:ring-2 focus:ring-blue-300 rounded-md read-only:bg-transparent read-only:ring-0" />
              </div>
            </div>

            <main>
              {/* Reuse button is removed */}
              {settlementId ? (
                <>
                  <ExpenseTable key={settlementId} settlementId={settlementId} isGuest={isGuest} isArchived={isArchived} title={title} setTitle={setTitle} subtitle={subtitle} setSubtitle={setSubtitle} participants={participants} setParticipants={setParticipants} expenses={expenses} setExpenses={setExpenses} personalDeductionItems={personalDeductionItems} setPersonalDeductionItems={setPersonalDeductionItems} onCompleteSettlement={handleCompleteSettlement} onReactivateSettlement={handleReactivateSettlement} showModal={showModal} />
                  <CommentSection settlementId={settlementId} isGuest={isGuest} isOwner={isOwner} showModal={showModal} refreshKey={commentRefreshKey} />
                </>
              ) : (
                <div className="text-center text-gray-500 mt-16">
                  <p>정산 내역이 없습니다. 새로운 정산을 시작하세요.</p>
                  <button onClick={createNewSettlement} disabled={isGuest} className="mt-4 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:bg-gray-400">
                    새 정산 시작하기
                  </button>
                </div>
              )}
            </main>
          </div>
        </>
      )}
    </div>
  );
}

export default App;

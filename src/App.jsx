import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { supabase } from './supabaseClient';

import PrivateRoute from './components/PrivateRoute';
import SettlementPage from './components/SettlementPage';
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import Modal from './components/Modal';
import Dashboard from './components/Dashboard';

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState('');
  const [isGuest, setIsGuest] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [modalState, setModalState] = useState({ isOpen: false, title: '', content: null, onConfirm: null });
  const [commentRefreshKey, setCommentRefreshKey] = useState(0);
  const [pageRefreshKey, setPageRefreshKey] = useState(0);
  const profileUsernameRef = useRef('');
  const [settlementList, setSettlementList] = useState([]);
  const navigate = useNavigate();
  const location = useLocation();

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
        .select('id, data, created_at, status, updated_at')
        .eq('user_id', targetUserId)
        .not('status', 'eq', 'deleted')
        .order('updated_at', { ascending: false });

    if (error) {
        console.error('Error fetching settlement list:', error);
        setSettlementList([]);
    } else {
        setSettlementList(data || []);
    }
  }, [getTargetUserId]);

  const createNewSettlement = useCallback(async () => {
    const user = session?.user;
    if (!user || isGuest) return;

    const targetUserId = getTargetUserId(user);
    
    const initialData = { title: '새로운 정산', subtitle: 'Gently Split the Bill FAST', participants: [{ id: 1, name: '참석자 1' }], expenses: [{ id: 1, itemName: '저녁 식사', totalCost: 100000, attendees: { 1: true } }], personalDeductionItems: {}, paymentStatus: {} };
    const { data: newSettlement, error: createError } = await supabase
        .from('settlements')
        .insert({ data: initialData, user_id: targetUserId, status: 'active' })
        .select()
        .single();

    if (createError) {
        console.error('Error creating new settlement:', createError);
        alert('새로운 정산 시트를 만드는 데 실패했습니다.');
    } else if (newSettlement) {
        fetchSettlementList(user);
        navigate(`/settlement/${newSettlement.id}`);
        setIsSidebarOpen(false);
    }
  }, [session, getTargetUserId, isGuest, navigate, fetchSettlementList]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (_event === 'SIGNED_OUT') {
        navigate('/');
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [navigate]);

  useEffect(() => {
    if (session) {
      const loadUserData = async () => {
        setLoading(true);
        const user = session.user;
        const isGuestUser = user.id === import.meta.env.VITE_GUEST_USER_ID;
        setIsGuest(isGuestUser);
        setIsOwner(user.id === import.meta.env.VITE_OWNER_USER_ID);

        if (isGuestUser) {
          setUsername('게스트');
        } else {
          const { data: profile } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', user.id)
            .single();
          setUsername(profile?.username || '사용자');
        }

        await fetchSettlementList(user);
        setLoading(false);
      };
      loadUserData();
    }
  }, [session, fetchSettlementList]);

  const showModal = useCallback(({ title, content, onConfirm = null }) => {
    setModalState({ isOpen: true, title, content, onConfirm });
  }, []);

  const closeModal = () => {
    setModalState({ isOpen: false, title: '', content: null, onConfirm: null });
  };

  const handleLogout = async () => { 
    await supabase.auth.signOut();
  };

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url)
      .then(() => {
        showModal({ title: '공유', content: '페이지 주소가 클립보드에 복사되었습니다.' });
      })
      .catch(err => {
        console.error('Failed to copy URL: ', err);
        showModal({ title: '오류', content: '주소 복사에 실패했습니다.' });
      });
  };
  
  const handleSelectSettlement = (id) => { 
    navigate(`/settlement/${id}`);
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
        setUsername(newUsername);
        setCommentRefreshKey(k => k + 1);
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

  const handleCompleteSettlement = async (settlementId, dataToSave) => {
    if (!settlementId || isGuest) return;

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
        setSettlementList(list => list.map(s => s.id === settlementId ? updatedSettlement : s).sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)));
        setPageRefreshKey(k => k + 1);
        navigate(`/settlement/${settlementId}`);
    }
  };

  const handleReactivateSettlement = async (idToReactivate) => {
    showModal({
      title: '정산 재활성화',
      content: '보관된 정산을 다시 수정하시겠습니까?',
      onConfirm: async () => {
        const { data: updatedSettlement, error: reactivateError } = await supabase
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
        setSettlementList(list => list.map(s => s.id === idToReactivate ? updatedSettlement : s).sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)));
        setPageRefreshKey(k => k + 1);
        navigate(`/settlement/${idToReactivate}`);
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
            if (location.pathname.includes(idToDelete)) {
                navigate('/dashboard');
            }
        }
      }
    });
  };

  if (loading) {
    return <div className="w-full h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="bg-gray-100 min-h-screen">
      <Modal 
        isOpen={modalState.isOpen}
        onClose={closeModal}
        title={modalState.title}
        onConfirm={modalState.onConfirm}
      >
        {modalState.content}
      </Modal>
      
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={
          <PrivateRoute session={session}>
            <Dashboard username={username} settlementList={settlementList} createNewSettlement={createNewSettlement} />
          </PrivateRoute>
        } />
        <Route path="/" element={
          <PrivateRoute session={session}>
            {isGuest ? (
              settlementList.length > 0 ? 
              <Navigate to={`/settlement/${settlementList[0].id}`} replace /> : null
            ) : (
              <Navigate to="/dashboard" replace />
            )}
          </PrivateRoute>
        } />
        <Route path="/settlement/:id" element={
          <PrivateRoute session={session}>
            <Sidebar 
              settlements={settlementList}
              onSelectSettlement={handleSelectSettlement} 
              onDeleteSettlement={handleDeleteSettlement}
              createNewSettlement={createNewSettlement}
              currentSettlementId={location.pathname.split('/').pop()}
              isGuest={isGuest}
              isOwner={isOwner}
              isOpen={isSidebarOpen}
              onClose={() => setIsSidebarOpen(false)}
              onOpenProfileModal={handleOpenProfileModal}
              onLogout={handleLogout}
            />
            <div className="w-full p-4 sm:p-6 lg:p-8">
              <header className="flex items-center justify-between w-full mb-6">
                <div className="flex items-center gap-2">
                  <button title="Open sidebar" onClick={() => setIsSidebarOpen(true)} className="bg-gray-200 hover:bg-gray-300 p-2 rounded-md">
                    <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                  </button>
                  <button title="Share URL" onClick={handleShare} className="bg-gray-200 hover:bg-gray-300 p-2 rounded-md">
                    <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12s-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.368a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"></path></svg>
                  </button>
                </div>
              </header>
              <SettlementPage 
                isGuest={isGuest} 
                isOwner={isOwner} 
                showModal={showModal} 
                commentRefreshKey={commentRefreshKey} 
                pageRefreshKey={pageRefreshKey}
                handleCompleteSettlement={handleCompleteSettlement}
                handleReactivateSettlement={handleReactivateSettlement}
              />
            </div>
          </PrivateRoute>
        } />
      </Routes>
    </div>
  );
}

export default App;
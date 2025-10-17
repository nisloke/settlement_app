import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import ExpenseTable from './ExpenseTable';
import CommentSection from './CommentSection';

const debounce = (func, delay) => {
  let timeout;
  const debounced = function executed(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, delay);
  };
  debounced.cancel = () => {
    clearTimeout(timeout);
  };
  return debounced;
};

const SettlementPage = ({ isGuest, isOwner, showModal, commentRefreshKey, pageRefreshKey, handleCompleteSettlement, handleReactivateSettlement }) => {
  const { id: settlementId } = useParams();
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [participants, setParticipants] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [personalDeductionItems, setPersonalDeductionItems] = useState({});
  const [paymentStatus, setPaymentStatus] = useState({});
  const [isArchived, setIsArchived] = useState(false);
  const [saveStatus, setSaveStatus] = useState('idle');
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  const loadSettlementData = useCallback(async (id) => {
    if (!id) return;
    const { data, error } = await supabase.from('settlements').select('id, data, status').eq('id', id).single();

    if (error) {
      console.error('Error fetching selected settlement:', error);
      setIsDataLoaded(true); // Allow editing even if fetch fails
    } else if (data) {
      const parsedData = data.data || {};
      setTitle(parsedData.title || '제목 없음');
      setSubtitle(parsedData.subtitle || '');
      setParticipants(parsedData.participants || []);
      setExpenses(parsedData.expenses || []);
      setPersonalDeductionItems(parsedData.personalDeductionItems || {});
      setPaymentStatus(parsedData.paymentStatus || {});
      setIsArchived(data.status === 'archived');
      setIsDataLoaded(true);

      if (data.status === 'active') {
        showModal({ title: '주의', content: '정산중입니다. 입금 금지!' });
      }
    }
  }, [showModal]);

  useEffect(() => {
    setIsDataLoaded(false);
    loadSettlementData(settlementId);
  }, [settlementId, pageRefreshKey, loadSettlementData]);

  useEffect(() => {
    if (!isDataLoaded || !settlementId || isGuest) return;

    const dataToSave = {
      title,
      subtitle,
      participants,
      expenses,
      personalDeductionItems,
      paymentStatus,
    };

    const debouncedSave = debounce(async () => {
      setSaveStatus('saving');
      const { error } = await supabase
        .from('settlements')
        .update({ data: dataToSave })
        .eq('id', settlementId);

      if (error) {
        console.error('Error saving settlement:', error);
        setSaveStatus('error');
      } else {
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      }
    }, 1000);

    // Do not save automatically for archived settlements, except for paymentStatus
    if (!isArchived) {
      debouncedSave();
    } else {
      // For archived settlements, only save if paymentStatus changes.
      // This is a simplified check. A deep comparison might be better.
      const debouncedPaymentSave = debounce(async () => {
        setSaveStatus('saving');
        const { error } = await supabase
          .from('settlements')
          .update({ data: { ...dataToSave } }) // Ensure other data is not lost
          .eq('id', settlementId);

        if (error) {
          console.error('Error saving payment status:', error);
          setSaveStatus('error');
        } else {
          setSaveStatus('saved');
          setTimeout(() => setSaveStatus('idle'), 2000);
        }
      }, 500);
      debouncedPaymentSave();
      return () => debouncedPaymentSave.cancel();
    }

    return () => {
      debouncedSave.cancel();
    };
  }, [isDataLoaded, title, subtitle, participants, expenses, personalDeductionItems, paymentStatus, settlementId, isGuest, isArchived]);

  if (!settlementId) {
    return <div className="text-center text-gray-500 mt-16">정산 내역을 선택하세요.</div>;
  }

  return (
    <>
      <div className="text-center mb-8">
        <div className="flex flex-col items-center max-w-2xl mx-auto">
          <input type="text" aria-label="Settlement title" value={title} onChange={(e) => setTitle(e.target.value)} readOnly={isGuest || isArchived} className="text-3xl sm:text-4xl font-bold text-gray-800 text-center bg-transparent w-full focus:outline-none focus:ring-2 focus:ring-blue-300 rounded-md read-only:bg-transparent read-only:ring-0" />
          <input type="text" aria-label="Settlement subtitle" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} readOnly={isGuest || isArchived} className="text-gray-500 mt-2 text-center bg-transparent w-full focus:outline-none focus:ring-2 focus:ring-blue-300 rounded-md read-only:bg-transparent read-only:ring-0" />
        </div>
      </div>

      <main>
        <ExpenseTable
          key={settlementId}
          settlementId={settlementId}
          isGuest={isGuest}
          isArchived={isArchived}
          participants={participants}
          setParticipants={setParticipants}
          expenses={expenses}
          setExpenses={setExpenses}
          personalDeductionItems={personalDeductionItems}
          setPersonalDeductionItems={setPersonalDeductionItems}
          paymentStatus={paymentStatus}
          setPaymentStatus={setPaymentStatus}
          onCompleteSettlement={() => handleCompleteSettlement(settlementId, { title, subtitle, participants, expenses, personalDeductionItems, paymentStatus })}
          onReactivateSettlement={() => handleReactivateSettlement(settlementId)}
          showModal={showModal}
          saveStatus={saveStatus}
        />
        <CommentSection
          settlementId={settlementId}
          isGuest={isGuest}
          isOwner={isOwner}
          showModal={showModal}
          refreshKey={commentRefreshKey}
        />
      </main>
    </>
  );
};

export default SettlementPage;

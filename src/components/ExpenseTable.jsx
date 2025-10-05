import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '../supabaseClient';

// Debounce function can be moved to a utils file later
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

const ExpenseTable = ({
  settlementId,
  isGuest,
  isArchived,
  title,
  subtitle,
  participants,
  setParticipants,
  expenses,
  setExpenses,
  personalDeductionItems,
  setPersonalDeductionItems,
  onCompleteSettlement,
  onReactivateSettlement,
}) => {
  const [editingCostId, setEditingCostId] = useState(null);
  const [saveStatus, setSaveStatus] = useState('idle'); // idle, saving, saved, error

  // Auto-save data to Supabase with debouncing
  useEffect(() => {
    if (!settlementId || isGuest || isArchived) return;

    const dataToSave = {
      title,
      subtitle,
      participants,
      expenses,
      personalDeductionItems,
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
        console.log('Settlement saved successfully!');
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      }
    }, 1000); // 1-second debounce

    debouncedSave();

    return () => {
      debouncedSave.cancel();
    };
  }, [title, subtitle, participants, expenses, personalDeductionItems, settlementId, isGuest, isArchived]);

  const handleCompleteSettlement = async () => {
    if (window.confirm('정말로 정산을 완료하시겠습니까? 완료 후에는 수정할 수 없습니다.')) {
      await onCompleteSettlement();
    }
  };

  const addParticipant = () => {
    const newId = participants.length > 0 ? Math.max(...participants.map(p => p.id)) + 1 : 1;
    
    setParticipants(prevParticipants => [...prevParticipants, { id: newId, name: `참석자 ${newId}` }]);

    setExpenses(prevExpenses => 
      prevExpenses.map(expense => ({
        ...expense,
        attendees: {
          ...expense.attendees,
          [newId]: true
        }
      }))
    );

    setPersonalDeductionItems(prevDeductions => {
      const newDeductions = { ...prevDeductions };
      for (const expenseId in newDeductions) {
        newDeductions[expenseId].deductingParticipants = {
          ...newDeductions[expenseId].deductingParticipants,
          [newId]: false
        };
      }
      return newDeductions;
    });
  };

  const removeParticipant = () => {
    if (participants.length <= 1) return alert('참석자는 최소 1명 이상이어야 합니다.');
    const lastParticipant = participants[participants.length - 1];
    setParticipants(participants.slice(0, -1));
    
    setExpenses(expenses.map(exp => {
      const newAttendees = { ...exp.attendees };
      delete newAttendees[lastParticipant.id];
      return { ...exp, attendees: newAttendees };
    }));

    setPersonalDeductionItems(prevDeductions => {
      const newDeductions = { ...prevDeductions };
      for (const expenseId in newDeductions) {
        delete newDeductions[expenseId].deductingParticipants[lastParticipant.id];
      }
      return newDeductions;
    });
  };

  const addExpense = () => {
    const newId = expenses.length > 0 ? Math.max(...expenses.map(e => e.id)) + 1 : 1;
    const initialAttendees = participants.reduce((acc, p) => ({ ...acc, [p.id]: true }), {});
    setExpenses([...expenses, { id: newId, itemName: '새 항목', totalCost: 0, attendees: initialAttendees }]);
  };

  const removeExpense = () => {
    if (expenses.length <= 1) return alert('비용 항목은 최소 1개 이상이어야 합니다.');
    const expenseToRemove = expenses[expenses.length - 1];
    setExpenses(expenses.slice(0, -1));

    setPersonalDeductionItems(prevDeductions => {
      const newDeductions = { ...prevDeductions };
      delete newDeductions[expenseToRemove.id];
      return newDeductions;
    });
  };

  const handleParticipantNameChange = (id, newName) => {
    setParticipants(participants.map(p => p.id === id ? { ...p, name: newName } : p));
  };

  const handleItemNameChange = (id, newItemName) => {
    setExpenses(expenses.map(e => {
      if (e.id === id) {
        setPersonalDeductionItems(prevDeductions => {
          if (prevDeductions[id]) {
            return { ...prevDeductions, [id]: { ...prevDeductions[id], itemName: newItemName } };
          }
          return prevDeductions;
        });
        return { ...e, itemName: newItemName };
      }
      return e;
    }));
  };

  const handleCostChange = (id, newCost) => {
    const cost = parseInt(newCost, 10);
    setExpenses(expenses.map(e => {
      if (e.id === id) {
        setPersonalDeductionItems(prevDeductions => {
          if (prevDeductions[id]) {
            return { ...prevDeductions, [id]: { ...prevDeductions[id], totalCost: isNaN(cost) ? 0 : cost } };
          }
          return prevDeductions;
        });
        return { ...e, totalCost: isNaN(cost) ? 0 : cost };
      }
      return e;
    }));
  };

  const handleAttendeeCheckboxChange = (expenseId, participantId) => {
    setExpenses(expenses.map(expense => {
      if (expense.id === expenseId) {
        return { ...expense, attendees: { ...expense.attendees, [participantId]: !expense.attendees[participantId] } };
      }
      return expense;
    }));
  };

  const handleIsPersonalExpenseChange = (expenseId) => {
    setPersonalDeductionItems(prevDeductions => {
      const newDeductions = { ...prevDeductions };
      const expense = expenses.find(e => e.id === expenseId);

      if (!expense) return prevDeductions;

      if (newDeductions[expenseId]) {
        delete newDeductions[expenseId];
      } else {
        const deductingParticipants = participants.reduce((acc, p) => ({ ...acc, [p.id]: false }), {});
        newDeductions[expenseId] = {
          id: expense.id,
          itemName: expense.itemName,
          totalCost: expense.totalCost,
          deductingParticipants: deductingParticipants
        };
      }
      return newDeductions;
    });
  };

  const handlePersonalDeductionCheckboxChange = (expenseId, participantId) => {
    setPersonalDeductionItems(prevDeductions => {
      const newDeductions = { ...prevDeductions };
      if (newDeductions[expenseId]) {
        const updatedDeductingParticipants = {
          ...newDeductions[expenseId].deductingParticipants,
          [participantId]: !newDeductions[expenseId].deductingParticipants[participantId]
        };
        newDeductions[expenseId] = {
          ...newDeductions[expenseId],
          deductingParticipants: updatedDeductingParticipants
        };
      }
      return newDeductions;
    });
  };

  const handleSelectAllForRow = (expenseId) => {
    setExpenses(expenses.map(expense => {
      if (expense.id === expenseId) {
        const currentAttendees = Object.values(expense.attendees);
        const areAllChecked = currentAttendees.length > 0 && currentAttendees.every(checked => checked);
        const newAttendees = {};
        participants.forEach(p => {
          newAttendees[p.id] = !areAllChecked;
        });
        return { ...expense, attendees: newAttendees };
      }
      return expense;
    }));
  };

  const totalExpensesSum = useMemo(() => {
    return expenses.reduce((sum, expense) => sum + expense.totalCost, 0);
  }, [expenses]);

  const participantTotals = useMemo(() => {
    const totals = {};
    participants.forEach(p => totals[p.id] = 0);
    expenses.forEach(expense => {
      const checkedAttendees = Object.keys(expense.attendees).filter(id => expense.attendees[id]);
      if (checkedAttendees.length > 0) {
        const costPerPerson = expense.totalCost / checkedAttendees.length;
        checkedAttendees.forEach(participantId => {
          totals[participantId] += costPerPerson;
        });
      }
    });
    return totals;
  }, [expenses, participants]);

  const finalTotals = useMemo(() => {
    const final = { ...participantTotals };
    
    for (const expenseId in personalDeductionItems) {
      const deductionItem = personalDeductionItems[expenseId];
      
      const deductingParticipantIds = participants.filter(p => deductionItem.deductingParticipants[p.id]);
      const numDeductingParticipants = deductingParticipantIds.length;

      if (numDeductingParticipants > 0) {
        const costPerDeductingParticipant = deductionItem.totalCost / numDeductingParticipants;
        deductingParticipantIds.forEach(p => {
          final[p.id] -= costPerDeductingParticipant;
        });
      }
    }
    return final;
  }, [participantTotals, personalDeductionItems, participants]);

  const hasActivePersonalDeductions = useMemo(() => {
    return Object.keys(personalDeductionItems).length > 0;
  }, [personalDeductionItems]);

  const finalGrandTotal = useMemo(() => {
    return Object.values(finalTotals).reduce((sum, total) => sum + total, 0);
  }, [finalTotals]);

  const readOnly = isGuest || isArchived;

  return (
    <>
      <div className="flex justify-end items-center gap-2 mb-2">
        <div className="text-sm text-gray-500 flex-grow">
          {saveStatus === 'saving' && '저장 중...'}
          {saveStatus === 'saved' && '저장됨'}
          {saveStatus === 'error' && '저장 오류'}
        </div>
        {isArchived && !isGuest && (
          <button onClick={() => onReactivateSettlement(settlementId)} className="bg-yellow-500 hover:bg-yellow-700 text-white font-bold py-1 px-3 rounded text-sm">
            수정하기 (재활성화)
          </button>
        )}
        {!isArchived && (
          <button onClick={handleCompleteSettlement} disabled={readOnly} className="bg-green-500 hover:bg-green-700 text-white font-bold py-1 px-3 rounded text-sm disabled:bg-gray-400">
            정산 완료
          </button>
        )}
        <button onClick={addParticipant} disabled={readOnly} className="w-6 h-6 flex items-center justify-center bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-400">+</button>
        <button onClick={removeParticipant} disabled={readOnly} className="w-6 h-6 flex items-center justify-center bg-red-500 text-white rounded-md hover:bg-red-600 disabled:bg-gray-400">-</button>
      </div>

      <div className="overflow-x-auto rounded-lg shadow-md bg-white">
        <table className="w-full text-sm text-left text-gray-700">
          <thead className="bg-gray-100 text-xs text-gray-700 uppercase">
            <tr>
              <th scope="col" className="py-3 px-4 border-r text-center">항목</th>
              <th scope="col" className="py-3 px-4 border-r text-center">비용</th>
              <th scope="col" className="py-3 px-4 border-r text-center whitespace-nowrap">사비</th>
              {participants.map(p => (
                <th key={p.id} scope="col" className="py-3 px-4">
                  <input type="text" value={p.name} onChange={(e) => handleParticipantNameChange(p.id, e.target.value)} readOnly={readOnly} className="w-full bg-transparent text-center font-bold read-only:bg-transparent read-only:ring-0"/>
                </th>
              ))}
              <th scope="col" className="py-3 px-4 border-l text-center whitespace-nowrap">전체</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map(expense => {
              const currentAttendees = Object.values(expense.attendees);
              const areAllChecked = currentAttendees.length > 0 && currentAttendees.every(checked => checked);

              return (
                <tr key={expense.id} className="border-b hover:bg-gray-50">
                  <td className="py-1 px-2 font-medium border-r"><input type="text" value={expense.itemName} onChange={(e) => handleItemNameChange(expense.id, e.target.value)} readOnly={readOnly} className="w-full p-2 read-only:bg-transparent read-only:ring-0"/></td>
                  <td className="py-1 px-4 border-r text-right whitespace-nowrap">
                    {editingCostId === expense.id && !readOnly ? (
                      <input
                        type="number"
                        value={expense.totalCost}
                        onChange={(e) => handleCostChange(expense.id, e.target.value)}
                        onBlur={() => setEditingCostId(null)}
                        className="w-full p-4 text-right"
                        autoFocus
                      />
                    ) : (
                      <span onClick={() => !readOnly && setEditingCostId(expense.id)} className={`block w-full p-4 ${!readOnly && 'cursor-pointer'}`}>
                        {expense.totalCost.toLocaleString()} 원
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 border-r text-center">
                    <input
                      type="checkbox"
                      className="w-4 h-4"
                      checked={!!personalDeductionItems[expense.id]}
                      onChange={() => handleIsPersonalExpenseChange(expense.id)}
                      disabled={readOnly}
                    />
                  </td>
                  {participants.map(p => (
                    <td key={p.id} className="py-3 px-4 text-center">
                      <input
                        type="checkbox"
                        className="w-4 h-4"
                        checked={!!expense.attendees[p.id]}
                        onChange={() => handleAttendeeCheckboxChange(expense.id, p.id)}
                        disabled={readOnly}
                      />
                    </td>
                  ))}
                  <td className="py-3 px-4 border-l text-center">
                    <input
                      type="checkbox"
                      className="w-4 h-4"
                      checked={areAllChecked}
                      onChange={() => handleSelectAllForRow(expense.id)}
                      disabled={readOnly}
                    />
                  </td>
                </tr>
              );
            })}
            <tr className="border-b">
              <td className="py-2 px-4">
                <div className="flex items-center gap-1">
                  <button onClick={addExpense} disabled={readOnly} className="w-6 h-6 flex items-center justify-center bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-400">+</button>
                  <button onClick={removeExpense} disabled={readOnly} className="w-6 h-6 flex items-center justify-center bg-red-500 text-white rounded-md hover:bg-red-600 disabled:bg-gray-400">-</button>
                </div>
              </td>
              <td colSpan={participants.length + 3}></td>
            </tr>
            {!hasActivePersonalDeductions && (
              <tr className="bg-gray-200 font-bold">
                <td className="py-3 px-4 border-r">합계</td>
                <td className="py-3 px-4 border-r text-right whitespace-nowrap">{totalExpensesSum.toLocaleString()} 원</td>
                <td className="py-3 px-4 border-r text-right"></td>
                {participants.map(p => (
                  <td key={p.id} className="py-3 px-4 text-gray-800 text-right whitespace-nowrap">
                    {Math.ceil(participantTotals[p.id] || 0).toLocaleString()} 원
                  </td>
                ))}
                <td className="border-l"></td>
              </tr>
            )}

            {Object.values(personalDeductionItems).map(deductionItem => (
              <tr key={deductionItem.id} className="border-b hover:bg-gray-50">
                <td className="py-1 px-2 font-medium border-r">{deductionItem.itemName}</td>
                <td className="py-1 px-4 border-r text-right whitespace-nowrap">{deductionItem.totalCost.toLocaleString()} 원</td>
                <td className="py-3 px-4 border-r text-center"></td>
                {participants.map(p => (
                  <td key={p.id} className="py-3 px-4 text-center">
                    <input
                      type="checkbox"
                      className="w-4 h-4"
                      checked={!!deductionItem.deductingParticipants[p.id]}
                      onChange={() => handlePersonalDeductionCheckboxChange(deductionItem.id, p.id)}
                      disabled={readOnly}
                    />
                  </td>
                ))}
                <td className="border-l"></td>
              </tr>
            ))}

            {hasActivePersonalDeductions && (
              <tr className="bg-gray-200 font-bold">
                <td className="py-3 px-4 border-r">합계</td>
                <td className="py-3 px-4 border-r text-right whitespace-nowrap">{Math.ceil(finalGrandTotal).toLocaleString()} 원</td>
                <td className="py-3 px-4 border-r"></td>
                {participants.map(p => (
                  <td key={p.id} className="py-3 px-4 text-gray-800 text-right whitespace-nowrap">
                    {Math.ceil(finalTotals[p.id] || 0).toLocaleString()} 원
                  </td>
                ))}
                <td className="border-l"></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
};

export default ExpenseTable;
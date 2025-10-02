import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const ExpenseTable = ({ onSettlementIdChange, isGuest, title, setTitle, subtitle, setSubtitle }) => {
  const [participants, setParticipants] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [personalDeductionItems, setPersonalDeductionItems] = useState({});
  const [editingCostId, setEditingCostId] = useState(null);
  const [settlementId, setSettlementId] = useState(null);
  const [saveStatus, setSaveStatus] = useState('idle'); // idle, saving, saved, error

  // Debounce function
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

  // Load data from Supabase on initial render
  useEffect(() => {
    const fetchSettlement = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const isGuestUser = user.id === import.meta.env.VITE_GUEST_USER_ID;

        const targetUserId = isGuestUser
          ? import.meta.env.VITE_OWNER_USER_ID
          : user.id;

        const { data, error } = await supabase
          .from('settlements')
          .select('id, data')
          .eq('user_id', targetUserId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 means no rows found
          console.error('Error fetching settlement:', error);
        } else if (data) {
          setSettlementId(data.id);
          onSettlementIdChange(data.id);
          const parsedData = data.data;
          setTitle(parsedData.title || 'Aloha RU 정산 시스템');
          setSubtitle(parsedData.subtitle || 'Gently Split the Bill FAST');
          setParticipants(parsedData.participants || []);
          setExpenses(parsedData.expenses || []);
          setPersonalDeductionItems(parsedData.personalDeductionItems || {});
        } else if (!isGuestUser) {
          // No existing settlement for this user, create a new one (only if not a guest)
          const initialParticipants = [{ id: 1, name: '참석자 1' }];
          const initialExpenses = [{ id: 1, itemName: '저녁 식사', totalCost: 100000, attendees: { 1: true } }];
          const initialData = {
            title,
            subtitle,
            participants: initialParticipants,
            expenses: initialExpenses,
            personalDeductionItems: {}
          };
          const { data: newSettlement, error: insertError } = await supabase
            .from('settlements')
            .insert({ data: initialData, user_id: user.id })
            .select()
            .single();

          if (insertError) {
            console.error('Error inserting initial settlement:', insertError);
          } else if (newSettlement) {
            setSettlementId(newSettlement.id);
            onSettlementIdChange(newSettlement.id);
            setParticipants(initialParticipants);
            setExpenses(initialExpenses);
            setPersonalDeductionItems({});
          }
        }
      }
    };

    fetchSettlement();
  }, []);

  // Auto-save data to Supabase with debouncing
  useEffect(() => {
    if (settlementId === null || isGuest) return; // Don't save if guest

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
      }
    }, 1000); // 1-second debounce

    debouncedSave();

    return () => {
      debouncedSave.cancel();
    };
  }, [title, subtitle, participants, expenses, personalDeductionItems, settlementId]);

  const addParticipant = () => {
    const newId = participants.length > 0 ? Math.max(...participants.map(p => p.id)) + 1 : 1;
    
    setParticipants(prevParticipants => [...prevParticipants, { id: newId, name: `참석자 ${newId}` }]);

    // Update existing expenses: new participant attends by default
    setExpenses(prevExpenses => 
      prevExpenses.map(expense => ({
        ...expense,
        attendees: {
          ...expense.attendees,
          [newId]: true
        }
      }))
    );

    // Update personal deduction items: new participant does not deduct by default
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
    
    // Remove participant from all expenses' attendees
    setExpenses(expenses.map(exp => {
      const newAttendees = { ...exp.attendees };
      delete newAttendees[lastParticipant.id];
      return { ...exp, attendees: newAttendees };
    }));

    // Remove participant from all personal deduction items
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

    // If the removed expense was a personal deduction item, remove it from personalDeductionItems
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
        // If this expense is a personal deduction item, update its name there too
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
        // If this expense is a personal deduction item, update its cost there too
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

  // Handles checkbox for regular attendees
  const handleAttendeeCheckboxChange = (expenseId, participantId) => {
    setExpenses(expenses.map(expense => {
      if (expense.id === expenseId) {
        return { ...expense, attendees: { ...expense.attendees, [participantId]: !expense.attendees[participantId] } };
      }
      return expense;
    }));
  };

  // New handler for "사비" checkbox
  const handleIsPersonalExpenseChange = (expenseId) => {
    setPersonalDeductionItems(prevDeductions => {
      const newDeductions = { ...prevDeductions };
      const expense = expenses.find(e => e.id === expenseId);

      if (!expense) return prevDeductions; // Should not happen

      if (newDeductions[expenseId]) {
        // If already a personal expense, remove it
        delete newDeductions[expenseId];
      } else {
        // If not a personal expense, add it
        const deductingParticipants = participants.reduce((acc, p) => ({ ...acc, [p.id]: false }), {});
        newDeductions[expenseId] = {
          id: expense.id, // Store expense ID for keying
          itemName: expense.itemName,
          totalCost: expense.totalCost,
          deductingParticipants: deductingParticipants
        };
      }
      return newDeductions;
    });
  };

  // New handler for checkboxes in dynamically created deduction rows
  const handlePersonalDeductionCheckboxChange = (expenseId, participantId) => {
    setPersonalDeductionItems(prevDeductions => {
      const newDeductions = { ...prevDeductions };
      if (newDeductions[expenseId]) {
        // Create a new deductingParticipants object to ensure React detects the change
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

  // Handler for "Select All" checkbox in a row (for regular attendees)
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
    const final = { ...participantTotals }; // Start with initial totals from regular expenses
    
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

  // Check if any personal expenses are active to conditionally render the '계' row
  const hasActivePersonalDeductions = useMemo(() => {
    return Object.keys(personalDeductionItems).length > 0;
  }, [personalDeductionItems]);

  const finalGrandTotal = useMemo(() => {
    return Object.values(finalTotals).reduce((sum, total) => sum + total, 0);
  }, [finalTotals]);

  return (
    <>
      <div className="flex justify-end items-center gap-2 mb-2">
        <div className="text-sm text-gray-500">
          {saveStatus === 'saving' && '저장 중...'}
          {saveStatus === 'saved' && '저장됨'}
          {saveStatus === 'error' && '저장 오류'}
        </div>
        <button onClick={addParticipant} disabled={isGuest} className="w-6 h-6 flex items-center justify-center bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-400">+</button>
        <button onClick={removeParticipant} disabled={isGuest} className="w-6 h-6 flex items-center justify-center bg-red-500 text-white rounded-md hover:bg-red-600 disabled:bg-gray-400">-</button>
      </div>

      <div className="overflow-x-auto rounded-lg shadow-md">
        <table className="w-full text-sm text-left text-gray-700 bg-white">
          <thead className="bg-gray-100 text-xs text-gray-700 uppercase">
            <tr>
              <th scope="col" className="py-3 px-4 border-r text-center">항목</th>
              <th scope="col" className="py-3 px-4 border-r text-center">비용</th>
              <th scope="col" className="py-3 px-4 border-r text-center whitespace-nowrap">사비</th>
              {participants.map(p => (
                <th key={p.id} scope="col" className="py-3 px-4">
                  <input type="text" value={p.name} onChange={(e) => handleParticipantNameChange(p.id, e.target.value)} readOnly={isGuest} className="w-full bg-transparent text-center font-bold"/>
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
                  <td className="py-1 px-2 font-medium border-r"><input type="text" value={expense.itemName} onChange={(e) => handleItemNameChange(expense.id, e.target.value)} readOnly={isGuest} className="w-full p-2"/></td>
                  <td className="py-1 px-4 border-r text-right whitespace-nowrap">
                    {editingCostId === expense.id && !isGuest ? (
                      <input
                        type="number"
                        value={expense.totalCost}
                        onChange={(e) => handleCostChange(expense.id, e.target.value)}
                        onBlur={() => setEditingCostId(null)}
                        className="w-full p-4 text-right"
                        autoFocus
                      />
                    ) : (
                      <span onClick={() => !isGuest && setEditingCostId(expense.id)} className={`block w-full p-4 ${!isGuest && 'cursor-pointer'}`}>
                        {expense.totalCost.toLocaleString()} 원
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 border-r text-center"> {/* "사비" checkbox */}
                    <input
                      type="checkbox"
                      className="w-4 h-4"
                      checked={!!personalDeductionItems[expense.id]} // Check if this expense is in personalDeductionItems
                      onChange={() => handleIsPersonalExpenseChange(expense.id)}
                      disabled={isGuest}
                    />
                  </td>
                  {participants.map(p => (
                    <td key={p.id} className="py-3 px-4 text-center">
                      <input
                        type="checkbox"
                        className="w-4 h-4"
                        checked={!!expense.attendees[p.id]}
                        onChange={() => handleAttendeeCheckboxChange(expense.id, p.id)}
                        disabled={isGuest}
                      />
                    </td>
                  ))}
                  <td className="py-3 px-4 border-l text-center">
                    <input
                      type="checkbox"
                      className="w-4 h-4"
                      checked={areAllChecked}
                      onChange={() => handleSelectAllForRow(expense.id)}
                      disabled={isGuest}
                    />
                  </td>
                </tr>
              );
            })}
            <tr className="border-b">
              <td className="py-2 px-4">
                <div className="flex items-center gap-1">
                  <button onClick={addExpense} disabled={isGuest} className="w-6 h-6 flex items-center justify-center bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-400">+</button>
                  <button onClick={removeExpense} disabled={isGuest} className="w-6 h-6 flex items-center justify-center bg-red-500 text-white rounded-md hover:bg-red-600 disabled:bg-gray-400">-</button>
                </div>
              </td>
              <td colSpan={participants.length + 3}></td> {/* Adjusted colSpan for new "사비" column */}
            </tr>
            {!hasActivePersonalDeductions && (
              <tr className="bg-gray-200 font-bold">
                <td className="py-3 px-4 border-r">합계</td>
                <td className="py-3 px-4 border-r text-right whitespace-nowrap">{totalExpensesSum.toLocaleString()} 원</td> {/* Display totalExpensesSum */}
                <td className="py-3 px-4 border-r text-right"></td> {/* Empty cell for "사비" in 합계 row */}
                {participants.map(p => (
                  <td key={p.id} className="py-3 px-4 text-gray-800 text-right whitespace-nowrap">
                    {Math.ceil(participantTotals[p.id] || 0).toLocaleString()} 원
                  </td>
                ))}
                <td className="border-l"></td>
              </tr>
            )}

            {/* Dynamically rendered personal deduction items */}
            {Object.values(personalDeductionItems).map(deductionItem => ( // Use Object.values to map over the items
              <tr key={deductionItem.id} className="border-b hover:bg-gray-50">
                <td className="py-1 px-2 font-medium border-r">{deductionItem.itemName}</td>
                <td className="py-1 px-4 border-r text-right whitespace-nowrap">{deductionItem.totalCost.toLocaleString()} 원</td>
                <td className="py-3 px-4 border-r text-center"></td> {/* Empty cell for "사비" column */}
                {participants.map(p => (
                  <td key={p.id} className="py-3 px-4 text-center">
                    <input
                      type="checkbox"
                      className="w-4 h-4"
                      checked={!!deductionItem.deductingParticipants[p.id]}
                      onChange={() => handlePersonalDeductionCheckboxChange(deductionItem.id, p.id)}
                      disabled={isGuest}
                    />
                  </td>
                ))}
                <td className="border-l"></td>
              </tr>
            ))}

            {hasActivePersonalDeductions && ( // Conditionally render '계' row
              <tr className="bg-gray-200 font-bold">
                <td className="py-3 px-4 border-r">계</td>
                <td className="py-3 px-4 border-r text-right whitespace-nowrap">{Math.ceil(finalGrandTotal).toLocaleString()} 원</td>
                <td className="py-3 px-4 border-r"></td> {/* Empty cell for "사비" in 계 row */}
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

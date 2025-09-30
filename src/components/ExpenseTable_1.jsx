import React, { useState, useMemo } from 'react';

const ExpenseTable = () => {
  const [participants, setParticipants] = useState([
    { id: 1, name: '참석자 1' },
  ]);

  const [expenses, setExpenses] = useState([
    { id: 1, itemName: '저녁 식사', totalCost: 100000, attendees: { 1: true } },
  ]);

  // New state for dynamically created personal expense deduction items
  const [personalDeductionItems, setPersonalDeductionItems] = useState({}); // { expenseId: { itemName, totalCost, deductingParticipants: { participantId: boolean } } }

  // State to manage which expense's totalCost is currently being edited
  const [editingCostId, setEditingCostId] = useState(null);

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
      <div className="flex justify-end gap-1 mb-2">
        <button onClick={addParticipant} className="w-6 h-6 flex items-center justify-center bg-blue-500 text-white rounded-md hover:bg-blue-600">+</button>
        <button onClick={removeParticipant} className="w-6 h-6 flex items-center justify-center bg-red-500 text-white rounded-md hover:bg-red-600">-</button>
      </div>

      <div className="overflow-x-auto rounded-lg shadow-md">
        <table className="w-full text-sm text-left text-gray-700 bg-white">
          <thead className="bg-gray-100 text-xs text-gray-700 uppercase">
            <tr>
              <th scope="col" className="py-3 px-4 border-r">항목</th>
              <th scope="col" className="py-3 px-4 border-r">총액</th>
              <th scope="col" className="py-3 px-4 border-r text-center">사비</th> {/* New "사비" column header */}
              {participants.map(p => (
                <th key={p.id} scope="col" className="py-3 px-4">
                  <input type="text" value={p.name} onChange={(e) => handleParticipantNameChange(p.id, e.target.value)} className="w-full bg-transparent text-center font-bold"/>
                </th>
              ))}
              <th scope="col" className="py-3 px-4 border-l text-center">전체</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map(expense => {
              const currentAttendees = Object.values(expense.attendees);
              const areAllChecked = currentAttendees.length > 0 && currentAttendees.every(checked => checked);

              return (
                <tr key={expense.id} className="border-b hover:bg-gray-50">
                  <td className="py-1 px-2 font-medium border-r"><input type="text" value={expense.itemName} onChange={(e) => handleItemNameChange(expense.id, e.target.value)} className="w-full p-2"/></td>
                  <td className="py-1 px-2 border-r text-right">
                    {editingCostId === expense.id ? (
                      <input
                        type="number"
                        value={expense.totalCost}
                        onChange={(e) => handleCostChange(expense.id, e.target.value)}
                        onBlur={() => setEditingCostId(null)}
                        className="w-full p-2 text-right"
                        autoFocus
                      />
                    ) : (
                      <span onClick={() => setEditingCostId(expense.id)} className="block w-full p-2 cursor-pointer">
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
                    />
                  </td>
                  {participants.map(p => (
                    <td key={p.id} className="py-3 px-4 text-center">
                      <input
                        type="checkbox"
                        className="w-4 h-4"
                        checked={!!expense.attendees[p.id]}
                        onChange={() => handleAttendeeCheckboxChange(expense.id, p.id)}
                      />
                    </td>
                  ))}
                  <td className="py-3 px-4 border-l text-center">
                    <input
                      type="checkbox"
                      className="w-4 h-4"
                      checked={areAllChecked}
                      onChange={() => handleSelectAllForRow(expense.id)}
                    />
                  </td>
                </tr>
              );
            })}
            <tr className="border-b">
              <td className="py-2 px-4">
                <div className="flex items-center gap-1">
                  <button onClick={addExpense} className="w-6 h-6 flex items-center justify-center bg-blue-500 text-white rounded-md hover:bg-blue-600">+</button>
                  <button onClick={removeExpense} className="w-6 h-6 flex items-center justify-center bg-red-500 text-white rounded-md hover:bg-red-600">-</button>
                </div>
              </td>
              <td colSpan={participants.length + 3}></td> {/* Adjusted colSpan for new "사비" column */}
            </tr>
            <tr className="bg-gray-200 font-bold">
              <td className="py-3 px-4 border-r">합계</td>
              <td className="py-3 px-4 border-r text-right">{totalExpensesSum.toLocaleString()} 원</td> {/* Display totalExpensesSum */}
              <td className="py-3 px-4 border-r text-right"></td> {/* Empty cell for "사비" in 합계 row */}
              {participants.map(p => (
                <td key={p.id} className="py-3 px-4 text-gray-800 text-right">
                  {Math.ceil(participantTotals[p.id] || 0).toLocaleString()} 원
                </td>
              ))}
              <td className="border-l"></td>
            </tr>

            {/* Dynamically rendered personal deduction items */}
            {Object.values(personalDeductionItems).map(deductionItem => ( // Use Object.values to map over the items
              <tr key={deductionItem.id} className="border-b hover:bg-gray-50">
                <td className="py-1 px-2 font-medium border-r">{deductionItem.itemName}</td>
                <td className="py-1 px-2 border-r text-right">{deductionItem.totalCost.toLocaleString()} 원</td>
                <td className="py-3 px-4 border-r text-center"></td> {/* Empty cell for "사비" column */}
                {participants.map(p => (
                  <td key={p.id} className="py-3 px-4 text-center">
                    <input
                      type="checkbox"
                      className="w-4 h-4"
                      checked={!!deductionItem.deductingParticipants[p.id]}
                      onChange={() => handlePersonalDeductionCheckboxChange(deductionItem.id, p.id)}
                    />
                  </td>
                ))}
                <td className="border-l"></td>
              </tr>
            ))}

            {hasActivePersonalDeductions && ( // Conditionally render '계' row
              <tr className="bg-blue-100 font-extrabold text-blue-800">
                <td className="py-3 px-4 border-r">계</td>
                <td className="py-3 px-4 border-r text-right">{Math.ceil(finalGrandTotal).toLocaleString()} 원</td>
                <td className="py-3 px-4 border-r"></td> {/* Empty cell for "사비" in 계 row */}
                {participants.map(p => (
                  <td key={p.id} className="py-3 px-4 text-right">
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

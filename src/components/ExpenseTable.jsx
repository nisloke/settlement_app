import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const ExpenseTable = ({ onSettlementIdChange }) => {
  const [participants, setParticipants] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [personalDeductionItems, setPersonalDeductionItems] = useState({});
  const [editingCostId, setEditingCostId] = useState(null);
  const [settlementId, setSettlementId] = useState(null);

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
      const { data, error } = await supabase
        .from('settlements')
        .select('id, data')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 means no rows found
        console.error('Error fetching settlement:', error);
      } else if (data) {
        setSettlementId(data.id);
        onSettlementIdChange(data.id);
        const parsedData = data.data;
        setParticipants(parsedData.participants || [{ id: 1, name: '참석자 1' }]);
        setExpenses(parsedData.expenses || [{ id: 1, itemName: '저녁 식사', totalCost: 100000, attendees: { 1: true } }]);
        setPersonalDeductionItems(parsedData.personalDeductionItems || {});
      } else {
        // No existing settlement, create a new one
        const initialParticipants = [{ id: 1, name: '참석자 1' }];
        const initialExpenses = [{ id: 1, itemName: '저녁 식사', totalCost: 100000, attendees: { 1: true } }];
        const initialData = {
          participants: initialParticipants,
          expenses: initialExpenses,
          personalDeductionItems: {}
        };
        const { data: newSettlement, error: insertError } = await supabase
          .from('settlements')
          .insert({ data: initialData })
          .select();

        if (insertError) {
          console.error('Error inserting initial settlement:', insertError);
        } else if (newSettlement && newSettlement.length > 0) {
          setSettlementId(newSettlement[0].id);
          onSettlementIdChange(newSettlement[0].id);
          setParticipants(initialParticipants);
          setExpenses(initialExpenses);
          setPersonalDeductionItems({});
        }
      }
    };

    fetchSettlement();
  }, []);

  // Auto-save data to Supabase with debouncing
  useEffect(() => {
    if (settlementId === null) return; // Don't save until settlementId is set

    const dataToSave = {
      participants,
      expenses,
      personalDeductionItems,
    };

    const debouncedSave = debounce(async () => {
      const { error } = await supabase
        .from('settlements')
        .update({ data: dataToSave })
        .eq('id', settlementId);

      if (error) {
        console.error('Error saving settlement:', error);
      } else {
        console.log('Settlement saved successfully!');
      }
    }, 1000); // 1-second debounce

    debouncedSave();

    return () => {
      debouncedSave.cancel();
    };
  }, [participants, expenses, personalDeductionItems, settlementId]);

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
              <th scope="col" className="py-3 px-4 border-r">비용</th>
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
                  <td className="py-1 px-4 border-r text-right">
                    {editingCostId === expense.id ? (
                      <input
                        type="number"
                        value={expense.totalCost}
                        onChange={(e) => handleCostChange(expense.id, e.target.value)}
                        onBlur={() => setEditingCostId(null)}
                        className="w-full p-4 text-right"
                        autoFocus
                      />
                    ) : (
                      <span onClick={() => setEditingCostId(expense.id)} className="block w-full p-4 cursor-pointer">
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
                <td className="py-1 px-4 border-r text-right">{deductionItem.totalCost.toLocaleString()} 원</td>
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

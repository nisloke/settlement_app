import React, { useState } from 'react';
import ExpenseTable from './components/ExpenseTable';
import CommentSection from './components/CommentSection';

function App() {
  const [settlementId, setSettlementId] = useState(null);

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <header className="text-center mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-800">
          Aloha RU 정산 시스템
        </h1>
        <p className="text-gray-500 mt-2">
          Gently Split the Bill FAST
        </p>
      </header>

      <main>
        <ExpenseTable onSettlementIdChange={setSettlementId} />

        {settlementId && <CommentSection settlementId={settlementId} />}
      </main>
    </div>
  );
}

export default App;
import React from 'react';
import { useNavigate } from 'react-router-dom';

const Dashboard = ({ username, settlementList, createNewSettlement }) => {
  const navigate = useNavigate();

  const handleContinueLatest = () => {
    if (settlementList && settlementList.length > 0) {
      // Assuming the list is sorted by last updated
      navigate(`/settlement/${settlementList[0].id}`);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-gray-100 min-h-screen">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">환영합니다, {username}님!</h1>
        <p className="text-gray-600 mt-1">오늘의 정산을 시작해 보세요.</p>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <button 
          onClick={createNewSettlement} 
          className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-6 px-8 rounded-lg shadow-lg transition-transform transform hover:scale-105 text-left"
        >
          <h2 className="text-2xl">새 정산 시작하기</h2>
          <p className="mt-1">새로운 비용 정산을 위한 페이지를 생성합니다.</p>
        </button>
        <button 
          onClick={handleContinueLatest} 
          disabled={!settlementList || settlementList.length === 0}
          className="bg-green-500 hover:bg-green-600 text-white font-bold py-6 px-8 rounded-lg shadow-lg transition-transform transform hover:scale-105 text-left disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          <h2 className="text-2xl">최근 정산 이어하기</h2>
          <p className="mt-1">가장 최근에 작업한 정산 페이지로 이동합니다.</p>
        </button>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-gray-700 mb-4">최근 정산 목록</h2>
        <div className="bg-white rounded-lg shadow-md">
          <ul className="divide-y divide-gray-200">
            {settlementList && settlementList.length > 0 ? (
              settlementList.slice(0, 5).map(settlement => {
                const settlementTitle = settlement.data?.title || '제목 없음';
                const date = new Date(settlement.updated_at || settlement.created_at).toLocaleDateString('ko-KR');
                const statusText = settlement.status === 'archived' ? '완료됨' : '진행중';
                const statusColor = settlement.status === 'archived' ? 'bg-gray-500' : 'bg-yellow-500';

                return (
                  <li key={settlement.id} onClick={() => navigate(`/settlement/${settlement.id}`)} className="p-4 hover:bg-gray-50 cursor-pointer flex justify-between items-center">
                    <div>
                      <p className="font-semibold text-gray-800">{settlementTitle}</p>
                      <p className="text-sm text-gray-500">{date}</p>
                    </div>
                    <span className={`px-2 py-1 text-xs font-semibold text-white rounded-full ${statusColor}`}>
                      {statusText}
                    </span>
                  </li>
                );
              })
            ) : (
              <li className="p-4 text-center text-gray-500">진행중인 정산이 없습니다.</li>
            )}
          </ul>
        </div>
      </section>
    </div>
  );
};

export default Dashboard;

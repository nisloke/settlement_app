import React, { useState, useMemo } from 'react';

const Sidebar = ({ settlements, onSelectSettlement, onDeleteSettlement, createNewSettlement, currentSettlementId, isGuest, isOpen, onClose }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState('latest'); // latest, oldest, title

  const filteredAndSortedSettlements = useMemo(() => {
    let filtered = settlements || [];

    if (searchTerm) {
        filtered = filtered.filter(s => 
            s.data?.title?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }

    const sorted = [...filtered].sort((a, b) => {
        switch (sortOrder) {
            case 'oldest':
                return new Date(a.created_at) - new Date(b.created_at);
            case 'title':
                return (a.data?.title || '').localeCompare(b.data?.title || '');
            case 'latest':
            default:
                return new Date(b.created_at) - new Date(a.created_at);
        }
    });

    return sorted;
  }, [settlements, searchTerm, sortOrder]);

  const handleSelect = (id) => {
    onSelectSettlement(id);
    onClose(); // Close sidebar after selection
  };

  const handleDelete = (e, id) => {
    e.stopPropagation();
    onDeleteSettlement(id);
  };

  const handleCreate = () => {
    createNewSettlement();
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black bg-opacity-50 z-30 transition-opacity duration-300 ease-in-out ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
        onClick={onClose}
      ></div>

      {/* Sidebar */}
      <aside 
        className={`fixed top-0 left-0 w-72 bg-white p-4 h-screen overflow-y-auto z-40 shadow-xl transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex justify-end items-center mb-2">
            <button onClick={onClose} className="p-1 text-gray-500 hover:text-gray-800 hover:bg-gray-200 rounded-full">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
        </div>

        {!isGuest && (
          <div className="mb-4">
              <button onClick={handleCreate} className="w-full bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
                  + 새 정산 시작
              </button>
          </div>
        )}

        <h2 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">정산 기록</h2>
        
        <div className="relative mb-4">
            <input 
                type="text"
                placeholder="제목으로 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full p-2 pl-8 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-300"
            />
            <svg className="w-4 h-4 absolute top-1/2 left-3 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
        </div>

        <div className="flex items-center justify-start gap-2 mb-4 text-sm">
            <button onClick={() => setSortOrder('latest')} className={`px-3 py-1 rounded-full ${sortOrder === 'latest' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'}`}>최신순</button>
            <button onClick={() => setSortOrder('oldest')} className={`px-3 py-1 rounded-full ${sortOrder === 'oldest' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'}`}>오래된순</button>
            <button onClick={() => setSortOrder('title')} className={`px-3 py-1 rounded-full ${sortOrder === 'title' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'}`}>제목순</button>
        </div>

        <ul>
          {filteredAndSortedSettlements.map(s => (
            <li key={s.id} 
                className={`p-3 mb-2 rounded-lg hover:bg-gray-100 flex justify-between items-center ${s.id === currentSettlementId ? 'bg-blue-100 ring-2 ring-blue-400' : ''}`}>
              <div className="flex-grow cursor-pointer" onClick={() => handleSelect(s.id)}>
                <p className="font-semibold truncate text-gray-700">{s.data?.title || '제목 없음'}</p>
                <div className="text-sm text-gray-500 flex justify-between items-center mt-1">
                  <span>{new Date(s.created_at).toLocaleDateString()}</span>
                  <span className={`font-bold text-xs px-2 py-1 rounded-full ${s.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                    {s.status === 'active' ? '진행중' : '완료됨'}
                  </span>
                </div>
              </div>
              {!isGuest && (
                <button onClick={(e) => handleDelete(e, s.id)} className="ml-2 p-1 text-gray-400 hover:text-red-600 hover:bg-red-100 rounded-full flex-shrink-0">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
              )}
            </li>
          ))}
        </ul>
      </aside>
    </>
  );
};

export default Sidebar;

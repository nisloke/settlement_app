import React from 'react';

const Modal = ({ isOpen, onClose, title, children, onConfirm, confirmText = '확인', cancelText = '취소' }) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose} // Close modal on overlay click
    >
      <div 
        className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm mx-4"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside modal
      >
        <h2 className="text-xl font-bold mb-4 text-gray-800">{title}</h2>
        <div className="text-gray-600 mb-6">
          {children}
        </div>
        <div className="flex justify-end gap-4">
          {onConfirm && (
            <button 
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
            >
              {cancelText}
            </button>
          )}
          <button 
            onClick={() => {
              if (onConfirm) {
                onConfirm();
              }
              onClose();
            }}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
            {onConfirm ? confirmText : '확인'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Modal;

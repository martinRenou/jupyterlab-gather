import React, { useEffect, useRef, useState } from 'react';

interface IModalProps {
  title: string;
  isOpen: boolean;
  hasCloseBtn?: boolean;
  onClose?: () => void;
  children: React.ReactNode;
}

const Modal = ({
  children,
  title,
  isOpen,
  hasCloseBtn,
  onClose
}: IModalProps) => {
  const [isModalOpen, setModalOpen] = useState(isOpen);
  const modalRef = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    setModalOpen(isOpen);
  }, [isOpen]);

  useEffect(() => {
    const modalElement = modalRef.current;
    if (modalElement) {
      if (isModalOpen) {
        modalElement.showModal();
      } else {
        modalElement.close();
      }
    }
  }, [isModalOpen]);

  const handleCloseModal = () => {
    if (onClose) {
      onClose();
    }
    setModalOpen(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDialogElement>) => {
    if (event.key === 'Escape') {
      handleCloseModal();
    }
  };

  return (
    <dialog ref={modalRef} onKeyDown={handleKeyDown} className="modal">
      <div className="modal-header">
        <div className="modal-title">{title}</div>
        {hasCloseBtn && (
          <button
            className="btn-common btn-danger modal-close-btn"
            onClick={handleCloseModal}
          >
            Close
          </button>
        )}
      </div>
      {children}
    </dialog>
  );
};

export default Modal;
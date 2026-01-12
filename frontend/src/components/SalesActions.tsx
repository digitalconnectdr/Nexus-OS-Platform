'use client';

import { useState } from 'react';
import CreateSaleForm from '@/components/CreateSaleForm';
import Modal from '@/components/Modal';

export default function SalesActions() {
    const [isModalOpen, setIsModalOpen] = useState(false);

    return (
        <>
            <button
                onClick={() => setIsModalOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-6 rounded-lg transition-all shadow-lg shadow-blue-500/25 flex items-center gap-2 active:transform active:scale-95"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                Nueva Venta
            </button>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title="Panel de Registro Operativo"
                maxWidth="max-w-6xl"
            >
                <CreateSaleForm onSuccess={() => setIsModalOpen(false)} />
            </Modal>
        </>
    );
}

'use client';

import { useState, useEffect } from 'react';
import { ShieldCheckIcon, KeyIcon, StopCircleIcon, UserPlusIcon, CheckCircleIcon, TrashIcon, LockClosedIcon, LockOpenIcon, MagnifyingGlassIcon, ChevronUpDownIcon, ChevronUpIcon, ChevronDownIcon, ArrowPathIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { fetchFromAPI } from '@/lib/api';
import Modal from '@/components/Modal';
import LoadingState from '@/components/ui/LoadingState';
import { InformationCircleIcon } from '@heroicons/react/20/solid';
import { usePermission } from '@/hooks/usePermission';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import {
    useReactTable,
    getCoreRowModel,
    getFilteredRowModel,
    getSortedRowModel,
    flexRender,
    SortingState,
    createColumnHelper,
    PaginationState
} from '@tanstack/react-table';
import { useDebounce } from 'use-debounce';
import { useAuth } from '@/context/AuthContext';

import { Tooltip } from '@/components/ui/tooltip';

const ROLE_LEVELS: Record<string, number> = {
    'Super Admin': 100,
    'Administrador': 90,
    'Cliente': 85,
    'Gerente': 80,
    'Supervisor Senior': 70,
    'Supervisor': 60,
    'Dpto Estadistica': 50,
    'Auditor Calidad': 50,
    'Seguimiento': 40,
    'Digitación': 30,
    'Representante': 10,
};

const InfoTooltip = ({ text }: { text: string }) => (
    <Tooltip content={text}>
        <InformationCircleIcon className="w-3.5 h-3.5 text-blue-400 cursor-help hover:text-blue-600 transition-colors ml-1.5" />
    </Tooltip>
);

export default function AdminUsersTable() {
    const { can } = usePermission();
    const { toast } = useToast();
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<any>(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [emailError, setEmailError] = useState<string | null>(null); // New state for email specific error
    const [tenantId, setTenantId] = useState<string | null>(null);
    const canChangeRole = can('system', 'users', 'update') || can('policies', 'policies', 'update');
    const [allProducts, setAllProducts] = useState<any[]>([]);
    const [supervisors, setSupervisors] = useState<any[]>([]);
    const [campaigns, setCampaigns] = useState<any[]>([]);
    const [organizations, setOrganizations] = useState<any[]>([]);
    const { user } = useAuth();

    // Password Reset States
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const [selectedUserForReset, setSelectedUserForReset] = useState<any>(null);
    const [pwdData, setPwdData] = useState({ password: '', confirm_password: '' });
    const [pwdActionLoading, setPwdActionLoading] = useState(false);
    const [pwdError, setPwdError] = useState<string | null>(null);

    // Table states
    const [sorting, setSorting] = useState<SortingState>([]);
    const [globalFilter, setGlobalFilter] = useState('');
    const [debouncedFilter] = useDebounce(globalFilter, 300);
    const [pagination, setPagination] = useState<PaginationState>({
        pageIndex: 0,
        pageSize: 20,
    });
    const [totalRecords, setTotalRecords] = useState(0);
    const [showDeleted, setShowDeleted] = useState(false);

    useEffect(() => {
        loadUsers();
    }, [pagination.pageIndex, pagination.pageSize, sorting, debouncedFilter, showDeleted]);

    useEffect(() => {
        loadTenant();
        loadMasterData();
    }, []);

    useEffect(() => {
        if (isModalOpen) {
            loadProducts();
        }
    }, [isModalOpen]);

    const loadMasterData = async () => {
        try {
            // Fetch supervisors via Selector for consistency
            const [supData, campData, orgData] = await Promise.all([
                fetchFromAPI('/api/v1/selectors/supervisors'),
                fetchFromAPI('/api/v1/campaigns/'),
                fetchFromAPI('/api/v1/organizations/')
            ]);
            setSupervisors(Array.isArray(supData) ? supData : (supData.items || []));
            setCampaigns(campData);
            setOrganizations(orgData);
        } catch (err) {
            console.error("Error cargando datos maestros", err);
        }
    };

    const loadProducts = async () => {
        try {
            const data = await fetchFromAPI('/api/v1/products/skills-manifest');
            // 'data' is already a list of {label, value}
            setAllProducts(data);
        } catch (err) {
            console.error("Error loading products", err);
        }
    };


    const loadTenant = async () => {
        try {
            const org = await fetchFromAPI('/api/v1/organizations/me');
            setTenantId(org.id);
        } catch (err) {
            console.error("Error al cargar tenant", err);
        }
    };

    const loadUsers = async () => {
        setLoading(true);
        try {
            const sort = sorting.length > 0
                ? (sorting[0].desc ? `-${sorting[0].id}` : sorting[0].id)
                : '';

            const params = new URLSearchParams({
                page: (pagination.pageIndex + 1).toString(),
                size: pagination.pageSize.toString(),
                include_inactive: 'true',  // Keep as string for URL params
                include_deleted: showDeleted.toString(),
            });

            if (debouncedFilter) params.append('search', debouncedFilter);
            if (sort) params.append('sort_by', sort);

            console.log('Loading users with params:', params.toString());
            const data = await fetchFromAPI(`/api/v1/users/?${params.toString()}`);
            console.log('Users loaded:', data);
            setUsers(data.items);
            setTotalRecords(data.total);
        } catch (err) {
            console.error('Error loading users:', err);
            // Set empty data on error
            setUsers([]);
            setTotalRecords(0);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveUser = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setActionLoading(true);
        setError(null);
        setEmailError(null);
        const formData = new FormData(e.currentTarget);

        const payload: any = {
            first_name: formData.get('first_name'),
            last_name: formData.get('last_name'),
            role: formData.get('role'),
            product_skills: Array.from(formData.getAll('product_skills')),
            custom_max_tasks: formData.get('custom_max_tasks') ? parseInt(formData.get('custom_max_tasks') as string) : null,
            // Nuevos campos operativos
            vicidial_user: formData.get('vicidial_user'),
            card_number: formData.get('card_number'),
            supervisor_id: formData.get('supervisor_id') || null,
            default_campaign_id: formData.get('default_campaign_id') || null,
            tenant_id: formData.get('tenant_id') || null,
            join_date: formData.get('join_date') ? new Date(formData.get('join_date') as string).toISOString() : null
        };

        // Solo incluir email y password si es creación
        if (!editingUser) {
            payload.email = formData.get('email');
            payload.password = formData.get('password');
            payload.tenant_id = tenantId;
            payload.is_active = true;
        }

        try {
            const url = editingUser ? `/api/v1/users/${editingUser.id}` : '/api/v1/users/';
            const method = editingUser ? 'PATCH' : 'POST';

            await fetchFromAPI(url, {
                method,
                body: JSON.stringify(payload)
            });
            setIsModalOpen(false);
            setEditingUser(null);
            loadUsers();
        } catch (err: any) {
            console.error("Error en la operación:", err);
            // fetchFromAPI ya extrae el .detail en el .message
            let errorMessage = err.message || 'Error al guardar usuario';

            // Si el mensaje es un objeto stringificado o un objeto real, intentar parsearlo
            if (typeof errorMessage === 'object') {
                errorMessage = JSON.stringify(errorMessage);
            }
            if (errorMessage === '[object Object]') {
                errorMessage = "Error desconocido del servidor (422/500). Ver Consola.";
                if (err.detail) errorMessage = Array.isArray(err.detail) ? err.detail.map((e: any) => e.msg).join(', ') : JSON.stringify(err.detail);
            }

            if (errorMessage.includes('El correo electrónico ya está registrado') || errorMessage.includes('Email already registered')) {
                setEmailError(errorMessage);
                // Don't set global error to avoid double alerting, or set it if you want both. 
                // User requested "cuadro de alerta rojo o debajo del campo del email".
                // Let's clear global error to focus on the specific field.
            } else {
                setError(errorMessage);
                toast({
                    title: "Error de Validación",
                    description: errorMessage,
                    variant: "destructive"
                });
            }
        } finally {
            setActionLoading(false);
        }
    };

    const handleEditClick = (user: any) => {
        setEditingUser(user);
        setIsModalOpen(true);
    };

    const handleOpenCreateModal = () => {
        setEditingUser(null);
        setError(null);
        setEmailError(null);
        setIsModalOpen(true);
    };

    const handleToggleStatus = (user: any) => {
        toast({
            title: user.is_active ? "¿Bloquear Usuario?" : "¿Reactivar Acceso?",
            description: user.is_active
                ? `El usuario ${user.first_name} perderá acceso inmediato al sistema.`
                : `Se restaurarán los privilegios de acceso para ${user.first_name}.`,
            action: (
                <ToastAction
                    altText="Confirmar"
                    onClick={async () => {
                        try {
                            await fetchFromAPI(`/api/v1/users/${user.id}`, {
                                method: 'PATCH',
                                body: JSON.stringify({ is_active: !user.is_active })
                            });
                            toast({
                                title: "Estado Actualizado",
                                description: `El usuario ahora está ${user.is_active ? 'Bloqueado' : 'Activo'}.`,
                            });
                            loadUsers();
                        } catch (err: any) {
                            toast({
                                title: "Error",
                                description: err.message || 'Error al cambiar estado',
                                variant: "destructive"
                            });
                        }
                    }}
                >
                    CONFIRMAR
                </ToastAction>
            )
        });
    };

    const handleDelete = (user: any) => {
        const displayName = (user.first_name && user.last_name)
            ? `${user.first_name} ${user.last_name}`
            : (user.first_name || user.last_name || user.email || "este usuario");

        if (user.is_deleted) {
            toast({
                title: "⚠️ ELIMINACIÓN PERMANENTE",
                description: `¿Está seguro de purgar a ${user.email}? Esta acción NO se puede deshacer.`,
                variant: "destructive",
                duration: Infinity,
                action: (
                    <ToastAction
                        altText="ELIMINAR"
                        className="bg-red-600 text-white hover:bg-red-700 border-none"
                        onClick={async () => {
                            try {
                                setActionLoading(true);
                                await fetchFromAPI(`/api/v1/users/${user.id}?permanent=true`, { method: 'DELETE' });
                                toast({ title: "Usuario Purgado", description: "El registro ha sido eliminado permanentemente." });
                                loadUsers();
                            } catch (err: any) {
                                toast({ title: "Error crítico", description: err.message, variant: "destructive" });
                            } finally {
                                setActionLoading(false);
                            }
                        }}
                    >
                        PURGAR
                    </ToastAction>
                )
            });
            return;
        }

        toast({
            title: "¿Mover a Eliminados?",
            description: `El acceso de ${displayName} será revocado.`,
            variant: "destructive",
            duration: Infinity,
            action: (
                <ToastAction
                    altText="ELIMINAR"
                    onClick={async () => {
                        try {
                            await fetchFromAPI(`/api/v1/users/${user.id}`, { method: 'DELETE' });
                            toast({ title: "Usuario Eliminado", description: "El usuario ha sido movido a la papelera." });
                            loadUsers();
                        } catch (error: any) {
                            toast({ title: "Error", description: error.message, variant: "destructive" });
                            loadUsers();
                        }
                    }}
                >
                    ELIMINAR
                </ToastAction>
            )
        });
    };

    const handleReactivate = (user: any) => {
        toast({
            title: "¿Reactivar Identidad?",
            description: `Se restaurará la cuenta de ${user.email}.`,
            action: (
                <ToastAction
                    altText="Reactivar"
                    onClick={async () => {
                        try {
                            setActionLoading(true);
                            await fetchFromAPI(`/api/v1/users/${user.id}/reactivate`, { method: 'POST' });
                            toast({ title: "Identidad Restaurada", description: "El usuario ya puede acceder nuevamente." });
                            loadUsers();
                        } catch (err: any) {
                            toast({ title: "Error", description: err.message, variant: "destructive" });
                        } finally {
                            setActionLoading(false);
                        }
                    }}
                >
                    REACTIVAR
                </ToastAction>
            )
        });
    };

    const getStatusBadge = (user: any) => {
        if (user.is_deleted) {
            return (
                <span className="bg-red-50 text-red-500 border border-red-100 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase block w-fit mx-auto flex items-center gap-1">
                    <XCircleIcon className="w-3 h-3" /> ELIMINADO
                </span>
            );
        }
        if (!user.is_active) {
            return (
                <span className="bg-gray-100 text-gray-500 border border-gray-200 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase block w-fit mx-auto flex items-center gap-1">
                    <LockClosedIcon className="w-3 h-3" /> BLOQUEADO
                </span>
            );
        }
        return (
            <span className="bg-green-50 text-green-700 border border-green-200 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase block w-fit mx-auto flex items-center gap-1">
                <CheckCircleIcon className="w-3 h-3" /> ACTIVO
            </span>
        );
    };

    const getRoleBadge = (role: string) => {
        const styles: any = {
            'Super Admin': 'bg-red-50 text-red-600 border-red-100',
            'Administrador': 'bg-purple-50 text-purple-600 border-purple-100',
            'Gerente': 'bg-indigo-50 text-indigo-600 border-indigo-100',
            'Supervisor Senior': 'bg-blue-100 text-blue-700 border-blue-200',
            'Supervisor': 'bg-blue-50 text-blue-600 border-blue-100',
            'Representante': 'bg-emerald-50 text-emerald-600 border-emerald-100',
            'Auditor Calidad': 'bg-orange-50 text-orange-600 border-orange-100',
            'Cliente': 'bg-slate-50 text-slate-600 border-slate-100',
            'Dpto Estadistica': 'bg-cyan-50 text-cyan-600 border-cyan-100',
            'Seguimiento': 'bg-teal-50 text-teal-600 border-teal-100',
            'Digitación': 'bg-rose-50 text-rose-600 border-rose-100',
        };
        return (
            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${styles[role] || 'bg-gray-50 text-gray-500 border-gray-100'}`}>
                {role}
            </span>
        );
    };

    // --- TABLE DEFINITION ---
    const columnHelper = createColumnHelper<any>();

    const columns = [
        columnHelper.accessor('organization_name', {
            id: 'organization',
            header: 'Nombre Organizacion',
            cell: info => <span className="text-[12px] font-semibold text-gray-600 uppercase tracking-tight">{info.getValue() || 'N/A'}</span>,
        }),
        columnHelper.accessor((row) => `${row.first_name} ${row.last_name}`, {
            id: 'name',
            header: 'Nombre',
            cell: info => <span className="text-[12px] font-bold text-gray-800 uppercase tracking-tight">{info.getValue()}</span>,
        }),
        columnHelper.accessor('email', {
            header: 'Email / Login',
            cell: info => <span className="text-[12px] font-semibold text-gray-500">{info.getValue()}</span>,
        }),
        columnHelper.accessor('role', {
            header: () => <div className="text-center">Rol</div>,
            cell: info => <div className="text-center">{getRoleBadge(info.getValue())}</div>,
        }),
        columnHelper.accessor('is_active', {
            id: 'status',
            header: () => <div className="text-center">Estado</div>,
            cell: info => <div className="text-center">{getStatusBadge(info.row.original)}</div>,
        }),
        columnHelper.display({
            id: 'actions',
            header: () => <div className="text-right">Acciones</div>,
            cell: info => (
                <div className="flex justify-end gap-2">
                    {!info.row.original.is_deleted ? (
                        <>
                            {(() => {
                                const targetLevel = ROLE_LEVELS[info.row.original.role] || 0;
                                const myLevel = ROLE_LEVELS[user?.role || ''] || 0;
                                const isSuperAdmin = user?.role === 'Super Admin' || user?.is_super_admin;
                                const canEditUser = isSuperAdmin || (myLevel > targetLevel);

                                return (
                                    <>
                                        {can('system', 'users', 'update') && canEditUser && (
                                            <button
                                                title="Editar Usuario"
                                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all"
                                                onClick={() => handleEditClick(info.row.original)}
                                            >
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                </svg>
                                            </button>
                                        )}
                                        {can('system', 'users', 'manage') && canEditUser && (
                                            <button
                                                title="Cambiar Contraseña"
                                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all"
                                                onClick={() => {
                                                    setSelectedUserForReset(info.row.original);
                                                    setPwdData({ password: '', confirm_password: '' });
                                                    setPwdError(null);
                                                    setIsPasswordModalOpen(true);
                                                }}
                                            >
                                                <KeyIcon className="w-5 h-5" />
                                            </button>
                                        )}
                                        {can('system', 'users', 'manage') && canEditUser && (
                                            <button
                                                title={info.row.original.is_active ? 'Bloquear Usuario' : 'Desbloquear Usuario'}
                                                className={`p-1.5 rounded transition-all ${info.row.original.is_active ? 'text-gray-400 hover:text-orange-600 hover:bg-orange-50' : 'text-orange-600 hover:bg-orange-100'}`}
                                                onClick={() => handleToggleStatus(info.row.original)}
                                            >
                                                {info.row.original.is_active ? <LockClosedIcon className="w-5 h-5" /> : <LockOpenIcon className="w-5 h-5" />}
                                            </button>
                                        )}
                                        {can('system', 'users', 'delete') && canEditUser && (
                                            <button
                                                title="Mover a Eliminados"
                                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-all"
                                                onClick={() => handleDelete(info.row.original)}
                                            >
                                                <TrashIcon className="w-5 h-5" />
                                            </button>
                                        )}
                                    </>
                                );
                            })()}
                        </>
                    ) : (
                        <>
                            {can('system', 'users', 'manage') && (
                                <button
                                    title="Reactivar Usuario"
                                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-all"
                                    onClick={() => handleReactivate(info.row.original)}
                                >
                                    <ArrowPathIcon className="w-5 h-5" />
                                </button>
                            )}
                            {can('system', 'users', 'update') && (
                                <button
                                    title="Eliminar Permanentemente"
                                    className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-all"
                                    onClick={() => handleDelete(info.row.original)}
                                >
                                    <TrashIcon className="w-5 h-5" strokeWidth={2.5} />
                                </button>
                            )}
                        </>
                    )}
                </div>
            ),
        }),
    ];

    const table = useReactTable({
        data: users,
        columns,
        state: {
            sorting,
            globalFilter,
            pagination,
        },
        onSortingChange: setSorting,
        onGlobalFilterChange: setGlobalFilter,
        onPaginationChange: setPagination,
        getCoreRowModel: getCoreRowModel(),
        manualPagination: true,
        manualSorting: true,
        manualFiltering: true,
        pageCount: Math.ceil(totalRecords / pagination.pageSize),
    });


    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        <ShieldCheckIcon className="w-6 h-6 text-blue-600" />
                        ADMINISTRACIÓN DE ACCESOS
                    </h2>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-1">Gestión Centralizada de Identidades y Roles</p>
                </div>
                {can('system', 'users', 'create') && (
                    <button
                        onClick={handleOpenCreateModal}
                        className="bg-blue-800 hover:bg-blue-900 text-white px-4 h-9 rounded-sm text-[11px] font-bold uppercase tracking-widest shadow-sm transition-all flex items-center gap-2"
                    >
                        <UserPlusIcon className="w-4 h-4" />
                        Nuevo Usuario
                    </button>
                )}
            </div>

            <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-gray-50/50 p-4 rounded-lg border border-gray-100">
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="relative w-full md:w-96">
                        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            value={globalFilter ?? ''}
                            onChange={e => setGlobalFilter(e.target.value)}
                            placeholder="Buscar usuario por nombre o email..."
                            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-md text-xs font-medium focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all"
                        />
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={showDeleted}
                            onChange={(e) => setShowDeleted(e.target.checked)}
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 transition-all"
                        />
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Ver Eliminados</span>
                    </label>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    <CheckCircleIcon className="w-4 h-4 text-green-500" />
                    {totalRecords} Usuarios Sincronizados
                </div>
            </div>

            <div className="overflow-hidden border border-gray-200 rounded-lg shadow-sm bg-white">
                <table className="w-full text-left text-sm text-gray-700">
                    <thead className="bg-gray-50 uppercase font-bold text-[13px] text-gray-500 border-b border-gray-200">
                        {table.getHeaderGroups().map(headerGroup => (
                            <tr key={headerGroup.id}>
                                {headerGroup.headers.map(header => (
                                    <th
                                        key={header.id}
                                        className={`px-6 py-4 ${header.column.getCanSort() ? 'cursor-pointer select-none hover:bg-gray-100/50 transition-colors' : ''}`}
                                        onClick={header.column.getToggleSortingHandler()}
                                    >
                                        <div className="flex items-center gap-2">
                                            {flexRender(header.column.columnDef.header, header.getContext())}
                                            {header.column.getCanSort() && (
                                                <div className="text-gray-300">
                                                    {{
                                                        asc: <ChevronUpIcon className="w-3 h-3 text-blue-600" />,
                                                        desc: <ChevronDownIcon className="w-3 h-3 text-blue-600" />,
                                                    }[header.column.getIsSorted() as string] ?? <ChevronUpDownIcon className="w-3 h-3" />}
                                                </div>
                                            )}
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        ))}
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {loading ? (
                            <tr><td colSpan={columns.length} className="px-6 py-4"><LoadingState message="Sincronizando con Auth..." /></td></tr>
                        ) : table.getRowModel().rows.length === 0 ? (
                            <tr><td colSpan={columns.length} className="px-6 py-12 text-center text-[12px] font-bold text-gray-300 uppercase tracking-widest">No se encontraron resultados</td></tr>
                        ) : table.getRowModel().rows.map(row => (
                            <tr key={row.id} className={`hover:bg-blue-50/30 transition-all group ${row.original.is_deleted ? 'bg-gray-50/50 opacity-60 grayscale-[0.8]' : !row.original.is_active ? 'opacity-70 grayscale-[0.5]' : ''}`}>
                                {row.getVisibleCells().map(cell => (
                                    <td key={cell.id} className="px-6 py-3">
                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* CONTROLES DE PAGINACIÓN */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 px-2 py-1">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Filas:</span>
                        <select
                            value={table.getState().pagination.pageSize}
                            onChange={e => {
                                table.setPageSize(Number(e.target.value));
                            }}
                            className="bg-white border border-gray-200 rounded px-2 py-1 text-[11px] font-bold text-gray-700 outline-none focus:border-blue-500 transition-all cursor-pointer"
                        >
                            {[10, 20, 50, 100].map(pageSize => (
                                <option key={pageSize} value={pageSize}>
                                    {pageSize}
                                </option>
                            ))}
                        </select>
                    </div>
                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                        Mostrando {table.getRowModel().rows.length} de {totalRecords} resultados
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        className="p-2 border border-gray-200 rounded-md bg-white hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage()}
                    >
                        <ChevronUpIcon className="w-4 h-4 -rotate-90" />
                    </button>

                    <div className="flex items-center gap-1 min-w-[100px] justify-center">
                        <span className="text-[11px] font-bold text-gray-700 uppercase">Página</span>
                        <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-[11px] font-black">
                            {table.getState().pagination.pageIndex + 1}
                        </span>
                        <span className="text-[11px] font-bold text-gray-400 uppercase">de {table.getPageCount()}</span>
                    </div>

                    <button
                        className="p-2 border border-gray-200 rounded-md bg-white hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        onClick={() => table.nextPage()}
                        disabled={!table.getCanNextPage()}
                    >
                        <ChevronUpIcon className="w-4 h-4 rotate-90" />
                    </button>
                </div>
            </div>

            {/* MODAL DE CAMBIO DE CONTRASEÑA */}
            <Modal
                isOpen={isPasswordModalOpen}
                onClose={() => setIsPasswordModalOpen(false)}
                title={
                    <div className="flex items-center gap-3">
                        <div className="p-1.5 bg-white/10 rounded-lg backdrop-blur-md border border-white/20">
                            <KeyIcon className="w-5 h-5 text-yellow-400" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-white tracking-tight uppercase leading-tight">
                                Reiniciar Contraseña
                            </h3>
                            <p className="text-[10px] text-blue-200/60 font-medium uppercase tracking-widest mt-0.5">Asignación Manual de Credenciales</p>
                        </div>
                    </div>
                }
                maxWidth="max-w-md"
            >
                <form
                    onSubmit={async (e) => {
                        e.preventDefault();
                        if (pwdData.password !== pwdData.confirm_password) {
                            setPwdError("Las contraseñas no coinciden");
                            return;
                        }
                        if (pwdData.password.length < 6) {
                            setPwdError("La contraseña debe tener al menos 6 caracteres");
                            return;
                        }

                        setPwdActionLoading(true);
                        setPwdError(null);
                        try {
                            await fetchFromAPI(`/api/v1/users/${selectedUserForReset.id}/password`, {
                                method: 'PATCH',
                                body: JSON.stringify(pwdData)
                            });
                            toast({
                                title: "✅ Password Actualizado",
                                description: "Las nuevas credenciales ya están activas.",
                            });
                            setIsPasswordModalOpen(false);
                        } catch (err: any) {
                            setPwdError(err.message || "Error al actualizar la contraseña");
                        } finally {
                            setPwdActionLoading(false);
                        }
                    }}
                    className="-m-6 bg-white"
                >
                    <div className="p-6 space-y-4">
                        <div className="bg-blue-50 p-3 border border-blue-100 rounded-md">
                            <p className="text-[10px] text-blue-800 font-bold uppercase leading-relaxed">
                                Estás cambiando la contraseña de: <br />
                                <span className="text-[12px] text-blue-900">{selectedUserForReset?.first_name} {selectedUserForReset?.last_name}</span>
                            </p>
                        </div>

                        {pwdError && (
                            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-[10px] font-bold uppercase animate-shake">
                                {pwdError}
                            </div>
                        )}

                        <div className="space-y-3">
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Nueva Contraseña</label>
                                <input
                                    required
                                    type="password"
                                    value={pwdData.password}
                                    onChange={(e) => setPwdData({ ...pwdData, password: e.target.value })}
                                    className="w-full border border-gray-300 rounded-md px-3 h-10 text-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all font-mono"
                                    placeholder="••••••••"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Confirmar Contraseña</label>
                                <input
                                    required
                                    type="password"
                                    value={pwdData.confirm_password}
                                    onChange={(e) => setPwdData({ ...pwdData, confirm_password: e.target.value })}
                                    className="w-full border border-gray-300 rounded-md px-3 h-10 text-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all font-mono"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 p-5 bg-gray-50 border-t border-gray-200">
                        <button
                            type="button"
                            onClick={() => setIsPasswordModalOpen(false)}
                            className="px-5 h-9 text-[10px] font-bold text-gray-500 uppercase tracking-widest hover:text-gray-900 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            disabled={pwdActionLoading || !pwdData.password || pwdData.password !== pwdData.confirm_password}
                            type="submit"
                            className="bg-gray-900 hover:bg-black text-white px-8 h-9 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all shadow-lg active:scale-95 disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed"
                        >
                            {pwdActionLoading ? 'Sincronizando...' : 'Actualizar Contraseña'}
                        </button>
                    </div>
                </form>
            </Modal>

            <Modal
                key={editingUser?.id || 'new'}
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setEditingUser(null); }}
                title={
                    <div className="flex items-center gap-3">
                        <div className="p-1.5 bg-white/10 rounded-lg backdrop-blur-md border border-white/20">
                            <ShieldCheckIcon className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-white tracking-tight uppercase leading-tight">
                                {editingUser ? "Modificar Acceso" : "Nuevo Acceso Maestro"}
                            </h3>
                            <p className="text-[10px] text-blue-200/60 font-medium uppercase tracking-widest mt-0.5">Control de Identidades y Privilegios</p>
                        </div>
                    </div>
                }
                maxWidth="max-w-5xl"
            >
                <form onSubmit={handleSaveUser} className="-m-6 flex flex-col bg-white">
                    <div className="p-5 space-y-5">
                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-xs font-bold uppercase animate-shake">
                                {error}
                            </div>
                        )}

                        <div className="space-y-4">
                            <div className="border-b border-gray-100 pb-1.5 flex justify-between items-center">
                                <p className="text-[12px] font-black text-gray-400 uppercase tracking-[0.2em]">01. Identidad y Credenciales</p>
                            </div>
                            <div className="grid grid-cols-12 gap-4">
                                <div className="col-span-12 md:col-span-4 space-y-1">
                                    <label className="text-[12px] font-bold text-gray-500 uppercase tracking-wider pl-1">Nombre</label>
                                    <input required name="first_name" defaultValue={editingUser?.first_name || ''} className="w-full border border-gray-300 rounded-md px-3 h-9 text-xs font-bold text-gray-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all uppercase" />
                                </div>
                                <div className="col-span-12 md:col-span-4 space-y-1">
                                    <label className="text-[12px] font-bold text-gray-500 uppercase tracking-wider pl-1">Apellido</label>
                                    <input required name="last_name" defaultValue={editingUser?.last_name || ''} className="w-full border border-gray-300 rounded-md px-3 h-9 text-xs font-bold text-gray-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all uppercase" />
                                </div>
                                <div className="col-span-12 md:col-span-4 space-y-1">
                                    <label className="text-[12px] font-bold text-gray-500 uppercase tracking-wider pl-1">Rol de Sistema</label>
                                    <select
                                        required
                                        name="role"
                                        defaultValue={editingUser?.role || 'Representante'}
                                        disabled={editingUser && !canChangeRole}
                                        className={`w-full border border-gray-300 rounded-md px-3 h-9 text-xs font-bold focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all uppercase appearance-none cursor-pointer ${editingUser && !canChangeRole ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : 'text-blue-900 bg-white shadow-sm'}`}
                                    >
                                        {Object.entries(ROLE_LEVELS).map(([roleName, level]) => {
                                            const myLevel = ROLE_LEVELS[user?.role || ''] || 0;
                                            const isSuperAdmin = user?.role === 'Super Admin' || user?.is_super_admin;

                                            // Hierarchy rule: Can only assign roles STRICTLY LOWER than own,
                                            // unless Super Admin.
                                            if (isSuperAdmin || (myLevel > level)) {
                                                return <option key={roleName} value={roleName}>{roleName}</option>;
                                            }
                                            return null;
                                        })}
                                    </select>
                                </div>
                                <div className="col-span-12 md:col-span-4 space-y-1">
                                    <label className="text-[12px] font-bold text-gray-500 uppercase tracking-wider pl-1 font-black text-rose-600">Organización (Multi-Tenant)</label>
                                    <select
                                        required
                                        name="tenant_id"
                                        defaultValue={editingUser?.tenant_id || tenantId || ''}
                                        disabled={(user?.role || user?.user_metadata?.role)?.trim().toUpperCase() !== 'SUPER ADMIN'}
                                        className={`w-full border border-gray-300 rounded-md px-3 h-9 text-xs font-bold focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all uppercase appearance-none cursor-pointer ${(user?.role || user?.user_metadata?.role)?.trim().toUpperCase() !== 'SUPER ADMIN' ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : 'text-rose-900 bg-white shadow-sm font-black'}`}
                                    >
                                        {organizations.map(org => (
                                            <option key={org.id} value={org.id}>{org.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="col-span-12 md:col-span-8 space-y-1">
                                    <label className="text-[12px] font-bold text-gray-500 uppercase tracking-wider pl-1">Correo Electrónico (Login Institucional)</label>
                                    <input
                                        required
                                        disabled={!!editingUser}
                                        type="email"
                                        name="email"
                                        onChange={() => setEmailError(null)} // Clear error on typing
                                        defaultValue={editingUser?.email || ''}
                                        className={`w-full border ${emailError ? 'border-red-500 ring-2 ring-red-100' : 'border-gray-300'} rounded-md px-3 h-9 text-xs font-bold focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all ${editingUser ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : 'text-gray-900 bg-white font-mono'}`}
                                        placeholder="usuario@nexus.com"
                                    />
                                    {emailError && (
                                        <div className="mt-1 bg-red-50 border border-red-200 text-red-600 px-3 py-2 rounded-md text-[11px] font-bold flex items-center gap-2 animate-pulse">
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                            </svg>
                                            {emailError}
                                        </div>
                                    )}
                                </div>
                                {!editingUser && (
                                    <div className="col-span-12 md:col-span-4 space-y-1">
                                        <label className="text-[12px] font-bold text-gray-500 uppercase tracking-wider pl-1">Contraseña Temporal</label>
                                        <input required type="password" name="password" className="w-full border border-gray-300 rounded-md px-3 h-9 text-xs font-bold text-gray-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all" placeholder="**********" />
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="border-b border-gray-100 pb-1.5 flex justify-between items-center">
                                <p className="text-[12px] font-black text-blue-600 uppercase tracking-[0.2em]">02. Parámetros Operativos</p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                {/* Columna 1 */}
                                <div className="space-y-4">
                                    <div className="space-y-1">
                                        <label className="text-[12px] font-bold text-gray-700 uppercase tracking-wider pl-1">ID Softphone / Vici</label>
                                        <input
                                            name="vicidial_user"
                                            defaultValue={editingUser?.vicidial_user}
                                            onChange={(e) => e.target.value = e.target.value.toUpperCase()}
                                            className="w-full border border-gray-300 rounded-md px-3 h-9 text-xs font-bold text-gray-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all uppercase bg-white"
                                            placeholder="EJE: 1001"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[12px] font-bold text-gray-700 uppercase tracking-wider pl-1">Número de Tarjeta</label>
                                        <input
                                            name="card_number"
                                            defaultValue={editingUser?.card_number}
                                            onChange={(e) => e.target.value = e.target.value.toUpperCase()}
                                            className="w-full border border-gray-300 rounded-md px-3 h-9 text-xs font-bold text-gray-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all uppercase bg-white"
                                            placeholder="0000-0000"
                                        />
                                    </div>
                                </div>

                                {/* Columna 2 */}
                                <div className="space-y-4">
                                    <div className="space-y-1">
                                        <label className="text-[12px] font-bold text-gray-700 uppercase tracking-wider pl-1 flex items-center">
                                            Jerarquía (Supervisor)
                                            <InfoTooltip text="Supervisor responsable de este agente." />
                                        </label>
                                        <select name="supervisor_id" defaultValue={editingUser?.supervisor_id || ''} className="w-full bg-white border border-gray-300 rounded-md px-3 h-9 text-xs font-bold text-gray-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all uppercase appearance-none cursor-pointer">
                                            <option value="">Sin Asignar</option>
                                            {supervisors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[12px] font-bold text-gray-700 uppercase tracking-wider pl-1">Asignación de Campaña</label>
                                        <select name="default_campaign_id" defaultValue={editingUser?.default_campaign_id || ''} className="w-full bg-white border border-gray-300 rounded-md px-3 h-9 text-xs font-bold text-gray-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all uppercase appearance-none cursor-pointer">
                                            <option value="">Sin Asignación</option>
                                            {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                    </div>
                                </div>

                                {/* Columna 3 */}
                                <div className="space-y-4">
                                    <div className="space-y-1">
                                        <label className="text-[12px] font-bold text-gray-700 uppercase tracking-wider pl-1">Fecha Efectiva Alta</label>
                                        <input type="date" name="join_date" defaultValue={editingUser?.join_date ? editingUser.join_date.split('T')[0] : ''} className="w-full bg-white border border-gray-300 rounded-md px-3 h-9 text-xs font-bold text-gray-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all opacity-80" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[12px] font-bold text-gray-700 uppercase tracking-wider pl-1 flex items-center">
                                            Límite WIP Individual
                                            <InfoTooltip text="Cantidad máxima de tareas activas simultáneas. Dejar vacío para usar el default del Rol." />
                                        </label>
                                        <input
                                            type="number"
                                            name="custom_max_tasks"
                                            defaultValue={editingUser?.custom_max_tasks}
                                            className="w-full border border-gray-300 rounded-md px-3 h-9 text-xs font-bold text-gray-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all uppercase"
                                            placeholder="Usa default"
                                        />
                                    </div>
                                </div>

                                {/* Skills (Ocupa todo el ancho) */}
                                <div className="col-span-full space-y-2 mt-2">
                                    <label className="text-[12px] font-bold text-gray-700 uppercase tracking-wider pl-1 flex items-center border-b border-gray-100 pb-1">
                                        Especialidades de Producto (Skills)
                                        <InfoTooltip text="Define qué productos puede gestionar este usuario." />
                                    </label>
                                    <div className="flex flex-wrap gap-4 p-3 border border-gray-100 rounded-md bg-gray-50/50">
                                        {allProducts.map(item => (
                                            <label key={item.value} className="flex items-center gap-2 cursor-pointer group whitespace-nowrap">
                                                <input
                                                    type="checkbox"
                                                    name="product_skills"
                                                    value={item.value}
                                                    defaultChecked={editingUser?.product_skills?.includes(item.value)}
                                                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 transition-all"
                                                />
                                                <span className="text-[10px] font-bold text-gray-600 uppercase group-hover:text-blue-600 transition-colors">
                                                    {item.label}
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-between p-5 bg-gray-50 border-t border-gray-200 shrink-0">
                        <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${editingUser?.is_active ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                            <span className="text-[12px] font-black text-gray-500 uppercase tracking-widest">{editingUser?.is_active ? 'ACCESO HABILITADO' : editingUser ? 'ACCESO RESTRINGIDO' : 'PREPARANDO IDENTIDAD'}</span>
                        </div>
                        <div className="flex gap-3">
                            <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 h-9 text-[10px] font-bold text-gray-500 uppercase tracking-widest hover:text-gray-900 hover:bg-gray-100 rounded-md transition-all">Cancelar</button>
                            <button disabled={actionLoading} type="submit" className="bg-gray-900 hover:bg-black text-white px-8 h-9 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all shadow-lg shadow-gray-200 active:scale-95 disabled:opacity-50">
                                {actionLoading ? 'Sincronizando...' : (editingUser ? 'Aplicar Cambios' : 'Crear Identidad')}
                            </button>
                        </div>
                    </div>
                </form>
            </Modal>
        </div>
    );
}

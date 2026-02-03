'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { fetchFromAPI } from '@/lib/api';

interface CreateSaleFormProps {
    onSuccess?: () => void;
}

export default function CreateSaleForm({ onSuccess }: CreateSaleFormProps) {
    const router = useRouter();
    const formRef = useRef<HTMLFormElement>(null);
    const [loading, setLoading] = useState(false);
    const [campaignsLoading, setCampaignsLoading] = useState(true);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [statuses, setStatuses] = useState<any[]>([]);
    const [statusesLoading, setStatusesLoading] = useState(true);
    const [supervisors, setSupervisors] = useState<any[]>([]);
    const [supervisorsLoading, setSupervisorsLoading] = useState(true);

    // Cascading States
    const [campaigns, setCampaigns] = useState<any[]>([]);
    const [families, setFamilies] = useState<string[]>([]);
    const [productNames, setProductNames] = useState<string[]>([]);
    const [plans, setPlans] = useState<any[]>([]);

    // Selected Values
    const [selectedCampaignId, setSelectedCampaignId] = useState('');
    const [selectedFamilyName, setSelectedFamilyName] = useState('');
    const [selectedProductName, setSelectedProductName] = useState('');
    const [selectedProductId, setSelectedProductId] = useState('');
    const [selectedSupervisorId, setSelectedSupervisorId] = useState('');

    // Pre-filled Data (Internal & Read-Only Display)
    const [price, setPrice] = useState('');
    const [pp, setPp] = useState('');
    const [concept, setConcept] = useState('');
    const [planName, setPlanName] = useState('');

    // 1. Initial Load: Selectors
    useEffect(() => {
        let mounted = true;

        // Load Campaigns via Selector
        fetchFromAPI('/api/v1/selectors/campaigns')
            .then(data => {
                if (mounted) {
                    setCampaigns(data);
                    setCampaignsLoading(false);
                }
            })
            .catch(err => {
                console.error('Failed to load campaigns:', err);
                if (mounted) setCampaignsLoading(false);
            });

        // Load Supervisors via Selector
        fetchFromAPI('/api/v1/selectors/supervisors')
            .then(data => {
                if (mounted) {
                    setSupervisors(data);
                    setSupervisorsLoading(false);
                }
            })
            .catch(err => {
                console.error('Failed to load supervisors:', err);
                if (mounted) setSupervisorsLoading(false);
            });

        // Load Statuses for validation via Selector
        fetchFromAPI('/api/v1/selectors/statuses')
            .then(data => {
                if (mounted) {
                    setStatuses(data);
                    setStatusesLoading(false);
                }
            })
            .catch(err => {
                console.error('Failed to load statuses:', err);
                if (mounted) setStatusesLoading(false);
            });

        return () => { mounted = false; };
    }, []);

    // 2. Cascade: Campaign -> Families (Using selectors)
    useEffect(() => {
        if (!selectedCampaignId) {
            setFamilies([]);
            return;
        }
        let mounted = true;
        // The original logic filtered by backend, but we can fetch all and filter locally for speed, 
        // OR just keep using the granular endpoints if they are light. 
        // Given the request for "Lightweight Selectors", let's load products once for the campaign.
        fetchFromAPI(`/api/v1/selectors/products?campaign_id=${selectedCampaignId}`)
            .then(data => {
                if (mounted) {
                    const uniqueFamilies = Array.from(new Set(data.map((p: any) => p.family_name)));
                    setFamilies(uniqueFamilies as string[]);
                    // Save full products for local filtering
                    setAllProducts(data);
                }
            })
            .catch(err => {
                console.error('Error fetching products via selector:', err);
                if (mounted) setFamilies([]);
            });
        return () => { mounted = false; };
    }, [selectedCampaignId]);

    const [allProducts, setAllProducts] = useState<any[]>([]);

    // 3. Cascade: Family -> Product Names (Local)
    useEffect(() => {
        if (!selectedFamilyName) {
            setProductNames([]);
            return;
        }
        const filtered = allProducts.filter(p => p.family_name === selectedFamilyName);
        setProductNames(Array.from(new Set(filtered.map(p => p.name))));
    }, [selectedFamilyName, allProducts]);

    // 4. Cascade: Product Name -> Plans (Local)
    useEffect(() => {
        if (!selectedProductName) {
            setPlans([]);
            return;
        }
        setPlans(allProducts.filter(p => p.name === selectedProductName));
    }, [selectedProductName, allProducts]);

    // 5. Final Selection: Plan -> Autofill
    useEffect(() => {
        const plan = plans.find(p => p.id === selectedProductId);
        if (plan) {
            setPrice(plan.current_price?.toString() || '');
            setPp(plan.current_pp || '');
            setConcept(plan.current_concept || '');
            setPlanName(plan.plan_name || plan.name);
        } else {
            setPrice('');
            setPp('');
            setConcept('');
            setPlanName('');
        }
    }, [selectedProductId, plans]);

    const handleCampaignChange = (e: any) => {
        setSelectedCampaignId(e.target.value);
        setSelectedFamilyName('');
        setSelectedProductName('');
        setSelectedProductId('');
    };

    const handleFamilyChange = (e: any) => {
        setSelectedFamilyName(e.target.value);
        setSelectedProductName('');
        setSelectedProductId('');
    };

    const handleProductChange = (e: any) => {
        setSelectedProductName(e.target.value);
        setSelectedProductId('');
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccess(false);

        const formData = new FormData(e.currentTarget);

        const data = {
            customer_name: formData.get('customer_name'),
            customer_doc_id: formData.get('customer_doc_id'),
            customer_contact: formData.get('customer_contact'),
            campaign_id: selectedCampaignId,
            supervisor_id: selectedSupervisorId,
            os_madre: formData.get('os_madre'),
            os_hija: formData.get('os_hija'),
            product_id: selectedProductId,
            // Enhanced Snapshots (price is internal state)
            snapshot_family: selectedFamilyName,
            snapshot_product_name: selectedProductName,
            snapshot_plan: planName,
            snapshot_price: parseFloat(price),
            snapshot_pp: pp || "Standard",
            snapshot_concept: concept || "Digital Product",
            tenant_id: "00000000-0000-0000-0000-000000000000",
        };

        try {
            // Note: tenant_id is now handled automatically by the backend based on current_user
            // We send the zero UUID as a placeholder
            const response = await fetchFromAPI('/api/v1/sales/', {
                method: 'POST',
                body: JSON.stringify(data),
            });

            // If we are here, it means the API returned 2xx
            setSuccess(true);

            // Dispatch event to refresh parent tables
            window.dispatchEvent(new Event('refresh-sales'));

            (onSuccess && typeof onSuccess === 'function') && onSuccess();

            if (formRef.current) {
                formRef.current.reset();
            }
            resetForm();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setSelectedCampaignId('');
        setSelectedFamilyName('');
        setSelectedProductName('');
        setSelectedProductId('');
        setSelectedSupervisorId('');
    };

    return (
        <div className="w-full h-full flex flex-col -m-6 max-h-[calc(100vh-2rem)] bg-white dark:bg-slate-900 transition-colors duration-300">
            <form
                ref={formRef}
                onSubmit={handleSubmit}
                className="flex-1 flex flex-col overflow-hidden"
            >
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {!statusesLoading && statuses.length === 0 && (
                        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/40 p-3 rounded-sm flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                            <span className="text-lg">⚠️</span>
                            <div>
                                <p className="text-[11px] font-black text-amber-900 dark:text-amber-400 uppercase">Sin Configuración de Operatividad</p>
                                <p className="text-[10px] text-amber-700 dark:text-amber-500">No tienes estatus de venta configurados. Por favor, ve a <b>Configuración &gt; Estatus</b> para crear uno antes de registrar ventas.</p>
                            </div>
                        </div>
                    )}
                    {/* Paso 1: Configuración de Producto (Cascada) */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-3">
                            <div className="h-4 w-1 bg-blue-600 dark:bg-blue-500"></div>
                            <h3 className="text-[10px] font-black text-gray-900 dark:text-white uppercase tracking-widest">1. Nodo de Producto & Operatividad</h3>
                        </div>

                        <div className="grid grid-cols-12 gap-3">
                            <div className="col-span-4 space-y-1">
                                <label className="block text-[11px] font-bold text-gray-700 dark:text-slate-400 uppercase tracking-tight font-black">01. Campaña</label>
                                <select
                                    required
                                    disabled={campaignsLoading}
                                    value={selectedCampaignId}
                                    onChange={handleCampaignChange}
                                    className="w-full bg-white dark:bg-slate-950 border border-gray-300 dark:border-slate-800 rounded-sm px-2 h-8 text-[12px] text-gray-900 dark:text-slate-100 focus:border-blue-600 dark:focus:border-blue-500 outline-none appearance-none cursor-pointer transition-all uppercase disabled:opacity-50 disabled:bg-gray-50 dark:disabled:bg-slate-900"
                                >
                                    <option value="" className="dark:bg-slate-950">{campaignsLoading ? '⏳ Cargando maestro...' : 'Seleccione...'}</option>
                                    {campaigns.map(c => <option key={c.id} value={c.id} className="dark:bg-slate-950">{c.name}</option>)}
                                </select>
                            </div>
                            <div className="col-span-4 space-y-1">
                                <label className="block text-[11px] font-bold text-gray-700 dark:text-slate-400 uppercase tracking-tight font-black">02. Supervisor</label>
                                <select
                                    required
                                    disabled={supervisorsLoading}
                                    value={selectedSupervisorId}
                                    onChange={(e) => setSelectedSupervisorId(e.target.value)}
                                    className="w-full bg-white dark:bg-slate-950 border border-gray-300 dark:border-slate-800 rounded-sm px-2 h-8 text-[12px] text-gray-900 dark:text-slate-100 focus:border-blue-600 dark:focus:border-blue-500 outline-none appearance-none cursor-pointer transition-all uppercase disabled:opacity-50 disabled:bg-gray-50 dark:disabled:bg-slate-900 font-bold"
                                >
                                    <option value="" className="dark:bg-slate-950">{supervisorsLoading ? '⏳ Cargando...' : 'Seleccione...'}</option>
                                    {supervisors.map(s => <option key={s.id} value={s.id} className="dark:bg-slate-950">{s.name}</option>)}
                                </select>
                            </div>
                            <div className="col-span-4 space-y-1">
                                <label className="block text-[11px] font-bold text-gray-700 dark:text-slate-400 uppercase tracking-tight font-black">03. Familia / Categoría</label>
                                <select
                                    required
                                    disabled={!selectedCampaignId}
                                    value={selectedFamilyName}
                                    onChange={handleFamilyChange}
                                    className="w-full bg-white dark:bg-slate-950 border border-gray-300 dark:border-slate-800 rounded-sm px-2 h-8 text-[12px] text-gray-900 dark:text-slate-100 focus:border-blue-600 dark:focus:border-blue-500 outline-none appearance-none cursor-pointer disabled:opacity-50 dark:disabled:bg-slate-900 transition-all uppercase"
                                >
                                    <option value="" className="dark:bg-slate-950">Seleccione...</option>
                                    {families.map(f => <option key={f} value={f} className="dark:bg-slate-950">{f}</option>)}
                                </select>
                            </div>
                            <div className="col-span-4 space-y-1">
                                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-tight font-black text-slate-700">04. Producto</label>
                                <select
                                    required
                                    disabled={!selectedFamilyName}
                                    value={selectedProductName}
                                    onChange={handleProductChange}
                                    className="w-full bg-white border border-gray-300 rounded-sm px-2 h-8 text-[12px] text-gray-900 focus:border-blue-600 outline-none appearance-none cursor-pointer disabled:opacity-50 transition-all uppercase"
                                >
                                    <option value="">{selectedFamilyName ? 'Seleccione...' : '--'}</option>
                                    {productNames.map(name => <option key={name} value={name}>{name}</option>)}
                                </select>
                            </div>

                            <div className="col-span-12 grid grid-cols-12 gap-3">
                                <div className="col-span-4 space-y-1">
                                    <label className="block text-[11px] font-bold text-gray-700 dark:text-slate-400 uppercase tracking-tight font-black">05. Plan Comercial</label>
                                    <select
                                        required
                                        disabled={!selectedProductName}
                                        value={selectedProductId}
                                        onChange={(e) => setSelectedProductId(e.target.value)}
                                        className="w-full bg-white dark:bg-slate-950 border border-gray-300 dark:border-slate-800 rounded-sm px-2 h-8 text-[12px] text-gray-900 dark:text-slate-100 focus:border-blue-600 dark:focus:border-blue-500 outline-none appearance-none cursor-pointer disabled:opacity-50 dark:disabled:bg-slate-900 transition-all uppercase"
                                    >
                                        <option value="" className="dark:bg-slate-950">{selectedProductName ? 'Seleccione...' : '--'}</option>
                                        {plans.map(p => <option key={p.id} value={p.id} className="dark:bg-slate-950">{p.plan_name || p.name}</option>)}
                                    </select>
                                </div>
                                <div className="col-span-4 space-y-1">
                                    <label className="block text-[11px] font-bold text-gray-500 dark:text-slate-600 uppercase">Concepto Factura (Auto)</label>
                                    <input
                                        disabled
                                        value={concept}
                                        className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-sm px-2 h-8 text-[12px] font-bold text-gray-400 dark:text-slate-600 cursor-not-allowed uppercase"
                                        placeholder="AUTOMÁTICO"
                                    />
                                </div>
                                <div className="col-span-4 space-y-1">
                                    <label className="block text-[11px] font-bold text-gray-500 dark:text-slate-600 uppercase">Referencia PP (Auto)</label>
                                    <input
                                        disabled
                                        value={pp}
                                        className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-sm px-2 h-8 text-[12px] font-bold text-gray-400 dark:text-slate-600 cursor-not-allowed uppercase"
                                        placeholder="AUTOMÁTICO"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-gray-100 my-1"></div>

                    {/* Paso 2: Información del Cliente y Orden */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-3">
                            <div className="h-4 w-1 bg-blue-600 dark:bg-blue-500"></div>
                            <h3 className="text-[10px] font-black text-gray-900 dark:text-white uppercase tracking-widest">2. Información Maestro & Despacho</h3>
                        </div>

                        <div className="grid grid-cols-12 gap-3">
                            <div className="col-span-4 space-y-1">
                                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-400 uppercase">Titular del Servicio</label>
                                <input
                                    required
                                    name="customer_name"
                                    onChange={(e) => e.target.value = e.target.value.toUpperCase()}
                                    className="w-full bg-white dark:bg-slate-950 border border-gray-300 dark:border-slate-800 rounded-sm px-2 h-8 text-[12px] text-gray-900 dark:text-slate-100 focus:border-blue-600 dark:focus:border-blue-500 outline-none transition-all"
                                    placeholder="JUAN PEREZ"
                                />
                            </div>
                            <div className="col-span-4 space-y-1">
                                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-400 uppercase">Doc. Identificación</label>
                                <input
                                    required
                                    name="customer_doc_id"
                                    onChange={(e) => e.target.value = e.target.value.toUpperCase()}
                                    className="w-full bg-white dark:bg-slate-950 border border-gray-300 dark:border-slate-800 rounded-sm px-2 h-8 text-[12px] text-gray-900 dark:text-slate-100 focus:border-blue-600 dark:focus:border-blue-500 outline-none transition-all"
                                    placeholder="CC / NIT"
                                />
                            </div>
                            <div className="col-span-4 space-y-1">
                                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-400 uppercase">Celular Contacto</label>
                                <input
                                    required
                                    name="customer_contact"
                                    type="tel"
                                    onChange={(e) => e.target.value = e.target.value.replace(/\D/g, '').slice(0, 11)}
                                    className="w-full bg-white dark:bg-slate-950 border border-gray-300 dark:border-slate-800 rounded-sm px-2 h-8 text-[12px] text-gray-900 dark:text-slate-100 focus:border-blue-600 dark:focus:border-blue-500 outline-none transition-all"
                                    placeholder="3000000000"
                                />
                            </div>

                            <div className="col-span-6 space-y-1">
                                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-400 uppercase">OS Madre</label>
                                <input
                                    required
                                    name="os_madre"
                                    maxLength={11}
                                    onChange={(e) => e.target.value = e.target.value.toUpperCase()}
                                    className="w-full bg-white dark:bg-slate-950 border border-gray-300 dark:border-slate-800 rounded-sm px-2 h-8 text-[12px] text-gray-900 dark:text-slate-100 focus:border-blue-600 dark:focus:border-blue-500 outline-none transition-all"
                                    placeholder="O-123456"
                                />
                            </div>
                            <div className="col-span-6 space-y-1">
                                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-400 uppercase">OS Hija (Opcional)</label>
                                <input
                                    name="os_hija"
                                    maxLength={11}
                                    onChange={(e) => e.target.value = e.target.value.toUpperCase()}
                                    className="w-full bg-white dark:bg-slate-950 border border-gray-300 dark:border-slate-800 rounded-sm px-2 h-8 text-[12px] text-gray-900 dark:text-slate-100 focus:border-blue-600 dark:focus:border-blue-500 outline-none transition-all"
                                    placeholder="OH-123"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Estado Final */}
                    <div className="h-6 flex items-center justify-center">
                        {success && (
                            <div className="bg-green-50 text-green-700 px-4 py-1 rounded-sm border border-green-200 text-[10px] font-bold uppercase tracking-wider animate-in fade-in slide-in-from-bottom-2">
                                ✅ Registrado con éxito
                            </div>
                        )}
                        {error && (
                            <div className="bg-red-50 text-red-700 px-4 py-1 rounded-sm border border-red-200 text-[10px] font-bold uppercase tracking-wider">
                                ❌ Error: {error}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center justify-end gap-3 p-4 bg-gray-50 dark:bg-slate-950 border-t border-gray-200 dark:border-slate-800 shrink-0">
                    <button type="button" onClick={() => onSuccess?.()} className="px-3 h-8 text-[11px] font-bold text-gray-500 dark:text-slate-400 uppercase hover:text-gray-900 dark:hover:text-white transition-colors">Cancelar</button>
                    <button
                        type="submit"
                        disabled={loading || !selectedProductId || statuses.length === 0}
                        className="bg-blue-700 dark:bg-blue-600 hover:bg-blue-800 dark:hover:bg-blue-700 text-white px-8 h-8 rounded-sm text-[11px] font-black uppercase transition-all shadow-md dark:shadow-none active:transform active:scale-95 disabled:opacity-50 tracking-widest"
                    >
                        {loading ? 'API...' : 'REGISTRAR VENTA'}
                    </button>
                </div>
            </form>
        </div>
    );
}

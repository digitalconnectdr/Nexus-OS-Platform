'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { fetchFromAPI } from '@/lib/api';

interface CreateSaleFormProps {
    onSuccess?: () => void;
}

export default function CreateSaleForm({ onSuccess }: CreateSaleFormProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [campaignsLoading, setCampaignsLoading] = useState(true);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

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

    // Pre-filled Data (Internal & Read-Only Display)
    const [price, setPrice] = useState('');
    const [pp, setPp] = useState('');
    const [concept, setConcept] = useState('');
    const [planName, setPlanName] = useState('');

    // 1. Initial Load: Campaigns
    useEffect(() => {
        let mounted = true;
        fetchFromAPI('/api/v1/campaigns/')
            .then(data => {
                if (mounted) {
                    setCampaigns(data);
                    setCampaignsLoading(false);
                }
            })
            .catch(err => console.error('Failed to load campaigns:', err));
        return () => { mounted = false; };
    }, []);

    // 2. Cascade: Campaign -> Families
    useEffect(() => {
        if (!selectedCampaignId) {
            setFamilies([]);
            return;
        }
        let mounted = true;
        fetchFromAPI(`/api/v1/products/families?campaign_id=${selectedCampaignId}`)
            .then(data => {
                if (mounted) {
                    setFamilies(Array.isArray(data) ? data : []);
                }
            })
            .catch(err => {
                console.error('Error fetching families:', err);
                if (mounted) setFamilies([]);
            });
        return () => { mounted = false; };
    }, [selectedCampaignId]);

    // 3. Cascade: Family -> Product Names
    useEffect(() => {
        if (!selectedFamilyName || !selectedCampaignId) {
            setProductNames([]);
            return;
        }
        let mounted = true;
        fetchFromAPI(`/api/v1/products/names?campaign_id=${selectedCampaignId}&family_name=${encodeURIComponent(selectedFamilyName)}`)
            .then(data => {
                if (mounted) {
                    setProductNames(Array.isArray(data) ? data : []);
                }
            })
            .catch(err => {
                console.error('Error fetching products:', err);
                if (mounted) setProductNames([]);
            });
        return () => { mounted = false; };
    }, [selectedFamilyName, selectedCampaignId]);

    // 4. Cascade: Product Name -> Plans
    useEffect(() => {
        if (!selectedProductName || !selectedFamilyName || !selectedCampaignId) {
            setPlans([]);
            return;
        }
        let mounted = true;
        const params = new URLSearchParams({
            campaign_id: selectedCampaignId,
            family_name: selectedFamilyName,
            product_name: selectedProductName
        });
        fetchFromAPI(`/api/v1/products/plans?${params.toString()}`)
            .then(data => {
                if (mounted) {
                    setPlans(Array.isArray(data) ? data : []);
                }
            })
            .catch(err => {
                console.error('Error fetching plans:', err);
                if (mounted) setPlans([]);
            });
        return () => { mounted = false; };
    }, [selectedProductName, selectedFamilyName, selectedCampaignId]);

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
            const orgData = await fetchFromAPI('/api/v1/organizations/me');
            data.tenant_id = orgData.id;

            const response = await fetchFromAPI('/api/v1/sales/', {
                method: 'POST',
                body: JSON.stringify(data),
            });

            // If we are here, it means the API returned 2xx
            setSuccess(true);

            // Dispatch event to refresh parent tables
            window.dispatchEvent(new Event('refresh-sales'));

            setTimeout(() => {
                if (onSuccess) onSuccess();
            }, 800);

            (e.target as HTMLFormElement).reset();
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
    };

    return (
        <div className="w-full h-full flex flex-col -m-6 max-h-[calc(100vh-2rem)]">
            <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {/* Paso 1: Configuración de Producto (Cascada) */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-3">
                            <div className="h-4 w-1 bg-blue-600"></div>
                            <h3 className="text-[10px] font-black text-gray-900 uppercase tracking-widest">1. Nodo de Producto & Operatividad</h3>
                        </div>

                        <div className="grid grid-cols-12 gap-3">
                            <div className="col-span-4 space-y-1">
                                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-tight font-black text-blue-600">01. Campaña</label>
                                <select
                                    required
                                    disabled={campaignsLoading}
                                    value={selectedCampaignId}
                                    onChange={handleCampaignChange}
                                    className="w-full bg-white border border-gray-300 rounded-sm px-2 h-8 text-[12px] text-gray-900 focus:border-blue-600 outline-none appearance-none cursor-pointer transition-all uppercase disabled:opacity-50 disabled:bg-gray-50"
                                >
                                    <option value="">{campaignsLoading ? '⏳ Cargando maestro...' : 'Seleccione...'}</option>
                                    {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div className="col-span-4 space-y-1">
                                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-tight font-black text-blue-600">02. Familia / Categoría</label>
                                <select
                                    required
                                    disabled={!selectedCampaignId}
                                    value={selectedFamilyName}
                                    onChange={handleFamilyChange}
                                    className="w-full bg-white border border-gray-300 rounded-sm px-2 h-8 text-[12px] text-gray-900 focus:border-blue-600 outline-none appearance-none cursor-pointer disabled:opacity-50 transition-all uppercase"
                                >
                                    <option value="">Seleccione...</option>
                                    {families.map(f => <option key={f} value={f}>{f}</option>)}
                                </select>
                            </div>
                            <div className="col-span-4 space-y-1">
                                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-tight font-black text-blue-600">03. Producto</label>
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

                            {/* Fila Oculta / Secundaria de Producto */}
                            <div className="col-span-12 grid grid-cols-12 gap-3">
                                <div className="col-span-4 space-y-1">
                                    <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-tight font-black text-blue-600">04. Plan Comercial</label>
                                    <select
                                        required
                                        disabled={!selectedProductName}
                                        value={selectedProductId}
                                        onChange={(e) => setSelectedProductId(e.target.value)}
                                        className="w-full bg-white border border-gray-300 rounded-sm px-2 h-8 text-[12px] text-gray-900 focus:border-blue-600 outline-none appearance-none cursor-pointer disabled:opacity-50 transition-all uppercase"
                                    >
                                        <option value="">{selectedProductName ? 'Seleccione...' : '--'}</option>
                                        {plans.map(p => <option key={p.id} value={p.id}>{p.plan_name || p.name}</option>)}
                                    </select>
                                </div>
                                <div className="col-span-4 space-y-1">
                                    <label className="block text-[11px] font-bold text-gray-500 uppercase">Concepto Factura (Auto)</label>
                                    <input
                                        disabled
                                        value={concept}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-sm px-2 h-8 text-[12px] font-bold text-gray-400 cursor-not-allowed uppercase"
                                        placeholder="AUTOMÁTICO"
                                    />
                                </div>
                                <div className="col-span-4 space-y-1">
                                    <label className="block text-[11px] font-bold text-gray-500 uppercase">Referencia PP (Auto)</label>
                                    <input
                                        disabled
                                        value={pp}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-sm px-2 h-8 text-[12px] font-bold text-gray-400 cursor-not-allowed uppercase"
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
                            <div className="h-4 w-1 bg-blue-600"></div>
                            <h3 className="text-[10px] font-black text-gray-900 uppercase tracking-widest">2. Información Maestro & Despacho</h3>
                        </div>

                        <div className="grid grid-cols-12 gap-3">
                            <div className="col-span-4 space-y-1">
                                <label className="block text-[11px] font-bold text-gray-700 uppercase">Titular del Servicio</label>
                                <input
                                    required
                                    name="customer_name"
                                    onChange={(e) => e.target.value = e.target.value.toUpperCase()}
                                    className="w-full bg-white border border-gray-300 rounded-sm px-2 h-8 text-[12px] text-gray-900 focus:border-blue-600 outline-none transition-all"
                                    placeholder="JUAN PEREZ"
                                />
                            </div>
                            <div className="col-span-4 space-y-1">
                                <label className="block text-[11px] font-bold text-gray-700 uppercase">Doc. Identificación</label>
                                <input
                                    required
                                    name="customer_doc_id"
                                    onChange={(e) => e.target.value = e.target.value.toUpperCase()}
                                    className="w-full bg-white border border-gray-300 rounded-sm px-2 h-8 text-[12px] text-gray-900 focus:border-blue-600 outline-none transition-all"
                                    placeholder="CC / NIT"
                                />
                            </div>
                            <div className="col-span-4 space-y-1">
                                <label className="block text-[11px] font-bold text-gray-700 uppercase">Celular Contacto</label>
                                <input
                                    required
                                    name="customer_contact"
                                    type="tel"
                                    onChange={(e) => e.target.value = e.target.value.replace(/\D/g, '').slice(0, 11)}
                                    className="w-full bg-white border border-gray-300 rounded-sm px-2 h-8 text-[12px] text-gray-900 focus:border-blue-600 outline-none transition-all"
                                    placeholder="3000000000"
                                />
                            </div>

                            <div className="col-span-6 space-y-1">
                                <label className="block text-[11px] font-bold text-gray-700 uppercase">OS Madre</label>
                                <input
                                    required
                                    name="os_madre"
                                    maxLength={11}
                                    onChange={(e) => e.target.value = e.target.value.toUpperCase()}
                                    className="w-full bg-white border border-gray-300 rounded-sm px-2 h-8 text-[12px] text-gray-900 focus:border-blue-600 outline-none transition-all"
                                    placeholder="O-123456"
                                />
                            </div>
                            <div className="col-span-6 space-y-1">
                                <label className="block text-[11px] font-bold text-gray-700 uppercase">OS Hija (Opcional)</label>
                                <input
                                    name="os_hija"
                                    maxLength={11}
                                    onChange={(e) => e.target.value = e.target.value.toUpperCase()}
                                    className="w-full bg-white border border-gray-300 rounded-sm px-2 h-8 text-[12px] text-gray-900 focus:border-blue-600 outline-none transition-all"
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

                <div className="flex items-center justify-end gap-3 p-4 bg-gray-50 border-t border-gray-200 shrink-0">
                    <button type="button" onClick={() => onSuccess?.()} className="px-3 h-8 text-[11px] font-bold text-gray-500 uppercase hover:text-gray-900 transition-colors">Cancelar</button>
                    <button
                        type="submit"
                        disabled={loading || !selectedProductId}
                        className="bg-blue-700 hover:bg-blue-800 text-white px-8 h-8 rounded-sm text-[11px] font-black uppercase transition-all shadow-md active:transform active:scale-95 disabled:opacity-50 tracking-widest"
                    >
                        {loading ? 'API...' : 'REGISTRAR VENTA'}
                    </button>
                </div>
            </form>
        </div>
    );
}

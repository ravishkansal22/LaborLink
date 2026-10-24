'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  MapPin,
  Home,
  Briefcase,
  Tag,
  AlertTriangle,
  Check,
  Building2,
  Navigation,
  User,
  Phone,
} from 'lucide-react';
import { useLocation } from '../../lib/location/LocationContext';
import type { SavedAddress, AddressLabel } from '../../lib/location/types';
import { useSession } from '../../lib/session';

export interface AddAddressSheetProps {
  open: boolean;
  onClose: () => void;
  addressToEdit?: SavedAddress | null;
  onChangeLocation?: () => void;
  onSuccess?: () => void;
}

export function AddAddressSheet({
  open,
  onClose,
  addressToEdit,
  onChangeLocation,
  onSuccess,
}: AddAddressSheetProps) {
  const { selected, current, saved, addAddress, updateAddress, selectSaved } = useLocation();
  const { session } = useSession();

  const [mounted, setMounted] = useState(false);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  // Form State
  const [houseFlat, setHouseFlat] = useState('');
  const [area, setArea] = useState('');
  const [landmark, setLandmark] = useState('');
  const [pincode, setPincode] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [phone, setPhone] = useState('');
  const [label, setLabel] = useState<AddressLabel>('Home');
  const [customLabel, setCustomLabel] = useState('');
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const firstInputRef = useRef<HTMLInputElement>(null);

  // Mount check and portal target
  useEffect(() => {
    setMounted(true);
    const container =
      document.querySelector<HTMLElement>('.device-screen') ||
      document.getElementById('device-scroll') ||
      document.body;
    setPortalTarget(container);
  }, []);

  // Derive coordinates and prefill area from selected / current location
  const locationCoords = useMemo(() => {
    if (addressToEdit) {
      return { lat: addressToEdit.lat, lng: addressToEdit.lng };
    }
    if (selected && 'lat' in selected && 'lng' in selected) {
      return { lat: selected.lat, lng: selected.lng };
    }
    if (current?.coords) {
      return current.coords;
    }
    return { lat: 28.7041, lng: 77.1025 }; // fallback
  }, [addressToEdit, selected, current]);

  const defaultArea = useMemo(() => {
    if (addressToEdit) return addressToEdit.area;
    if (selected) {
      if ('area' in selected && selected.area) return selected.area;
      if ('title' in selected) return `${selected.title}${selected.subtitle ? `, ${selected.subtitle}` : ''}`;
    }
    if (current?.addressLine) {
      return current.addressLine;
    }
    return 'Sector 9, Rohini, New Delhi';
  }, [addressToEdit, selected, current]);

  // Reset or prefill form on open / addressToEdit change
  useEffect(() => {
    if (open) {
      if (addressToEdit) {
        setHouseFlat(addressToEdit.line1);
        setArea(addressToEdit.area);
        setLandmark(addressToEdit.landmark ?? '');
        setPincode(addressToEdit.pincode ?? '');
        setReceiverName(addressToEdit.receiverName ?? '');
        setPhone(addressToEdit.phone ? addressToEdit.phone.replace(/^\+91\s*/, '') : '');
        if (addressToEdit.label === 'Home' || addressToEdit.label === 'Work') {
          setLabel(addressToEdit.label);
          setCustomLabel('');
        } else {
          setLabel('Other');
          setCustomLabel(addressToEdit.label);
        }
      } else {
        setHouseFlat('');
        setArea(defaultArea);
        setLandmark('');
        setPincode('');
        setReceiverName(session?.employer?.name ?? '');
        const existingPhone = session?.employer?.phone ? session.employer.phone.replace(/^\+91\s*/, '') : '';
        setPhone(existingPhone);
        setLabel('Home');
        setCustomLabel('');
      }
      setConfirmReplace(false);
      setTouched({});

      const timer = setTimeout(() => {
        firstInputRef.current?.focus();
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [open, addressToEdit, defaultArea, session]);

  // Check if a Home or Work address already exists (other than current edit)
  const existingSameLabelAddress = useMemo(() => {
    if (label !== 'Home' && label !== 'Work') return null;
    return saved.find((addr) => addr.label === label && addr.id !== addressToEdit?.id) ?? null;
  }, [label, saved, addressToEdit]);

  // Validation
  const errors = useMemo(() => {
    const errs: Record<string, string> = {};
    if (!houseFlat.trim()) {
      errs.houseFlat = 'House / Flat / Floor is required';
    }
    if (!area.trim()) {
      errs.area = 'Area / Locality is required';
    }
    const cleanPhone = phone.trim().replace(/\D/g, '');
    if (!cleanPhone) {
      errs.phone = 'Mobile number is required';
    } else if (cleanPhone.length !== 10) {
      errs.phone = 'Please enter a valid 10-digit mobile number';
    }
    if (pincode.trim()) {
      const cleanPin = pincode.trim().replace(/\D/g, '');
      if (cleanPin.length !== 6) {
        errs.pincode = 'Pincode must be exactly 6 digits';
      }
    }
    if (label === 'Other' && !customLabel.trim()) {
      errs.customLabel = 'Please enter a label name (e.g. Gym, Parents)';
    }
    return errs;
  }, [houseFlat, area, phone, pincode, label, customLabel]);

  const isValid = Object.keys(errors).length === 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) {
      setTouched({
        houseFlat: true,
        area: true,
        phone: true,
        pincode: true,
        customLabel: true,
      });
      return;
    }

    // If replacement exists and user hasn't explicitly agreed yet
    if (existingSameLabelAddress && !confirmReplace) {
      setConfirmReplace(true);
      return;
    }

    const cleanPhone = phone.trim().replace(/\D/g, '');
    const finalLabel: AddressLabel = label === 'Other'
      ? ((customLabel.trim() || 'Other') as AddressLabel)
      : label;

    const payload = {
      label: finalLabel,
      line1: houseFlat.trim(),
      area: area.trim(),
      city: 'Delhi',
      pincode: pincode.trim() || undefined,
      landmark: landmark.trim() || undefined,
      receiverName: receiverName.trim() || undefined,
      phone: `+91 ${cleanPhone}`,
      lat: locationCoords.lat,
      lng: locationCoords.lng,
    };

    if (addressToEdit) {
      // Editing existing address
      updateAddress(addressToEdit.id, payload);
      selectSaved(addressToEdit.id);
    } else if (existingSameLabelAddress && confirmReplace) {
      // Replacing existing Home/Work address
      updateAddress(existingSameLabelAddress.id, payload);
      selectSaved(existingSameLabelAddress.id);
    } else {
      // Adding fresh address
      addAddress(payload);
    }

    onClose();
    onSuccess?.();
  };

  if (!mounted || !portalTarget || !open) return null;

  const content = (
    <div
      className="absolute inset-0 z-[110] flex flex-col justify-end"
      role="dialog"
      aria-modal="true"
      aria-label={addressToEdit ? 'Edit Address' : 'Add New Address'}
    >
      {/* Dimmed Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-[1px] transition-opacity duration-200"
        aria-hidden="true"
      />

      {/* Slide-Up Bottom Sheet */}
      <div
        className="relative z-10 w-full max-h-[85%] bg-white rounded-t-[26px] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-250 ease-out"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag Handle */}
        <div className="w-10 h-1 rounded-full bg-slate-300 mx-auto mt-2.5 mb-1 shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-2.5 border-b border-slate-100 shrink-0">
          <h3 className="font-bold text-[17px] text-[var(--loc-text)] tracking-tight">
            {addressToEdit ? 'Edit Address' : 'Enter complete address'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--loc-green)]"
            aria-label="Close address sheet"
          >
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-4 overscroll-contain">
          {/* Top: Location Pin Summary */}
          <div className="flex items-center justify-between gap-3 p-3 bg-[var(--loc-bg)] rounded-2xl border border-slate-100">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-[var(--loc-green-soft)] text-[var(--loc-green)] flex items-center justify-center shrink-0">
                <MapPin size={17} strokeWidth={2.5} />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--loc-muted)] block">
                  Delivering to this pin
                </span>
                <p className="text-xs font-semibold text-slate-800 truncate mt-0.5">
                  {defaultArea}
                </p>
              </div>
            </div>

            {onChangeLocation && (
              <button
                type="button"
                onClick={onChangeLocation}
                className="text-xs font-bold text-[var(--loc-green)] px-2.5 py-1 rounded-lg hover:bg-[var(--loc-green-soft)] transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--loc-green)]"
              >
                Change
              </button>
            )}
          </div>

          {/* "Save address as" Chips */}
          <div className="space-y-1.5 pt-1">
            <label className="text-xs font-semibold text-[var(--loc-muted)] uppercase tracking-wider block">
              Save address as <span className="text-red-500">*</span>
            </label>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setLabel('Home');
                  setConfirmReplace(false);
                }}
                className={`flex-1 flex items-center justify-center gap-1.5 h-10 px-3 rounded-xl border text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--loc-green)] ${
                  label === 'Home'
                    ? 'bg-[var(--loc-green-soft)] border-[var(--loc-green)] text-[var(--loc-green)] shadow-sm'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Home size={15} strokeWidth={2.2} />
                <span>Home</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setLabel('Work');
                  setConfirmReplace(false);
                }}
                className={`flex-1 flex items-center justify-center gap-1.5 h-10 px-3 rounded-xl border text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--loc-green)] ${
                  label === 'Work'
                    ? 'bg-[var(--loc-green-soft)] border-[var(--loc-green)] text-[var(--loc-green)] shadow-sm'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Briefcase size={15} strokeWidth={2.2} />
                <span>Work</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setLabel('Other');
                  setConfirmReplace(false);
                }}
                className={`flex-1 flex items-center justify-center gap-1.5 h-10 px-3 rounded-xl border text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--loc-green)] ${
                  label === 'Other'
                    ? 'bg-[var(--loc-green-soft)] border-[var(--loc-green)] text-[var(--loc-green)] shadow-sm'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Tag size={15} strokeWidth={2.2} />
                <span>Other</span>
              </button>
            </div>

            {/* Other custom label input */}
            {label === 'Other' && (
              <div className="pt-2 animate-in fade-in duration-150">
                <input
                  type="text"
                  value={customLabel}
                  onChange={(e) => setCustomLabel(e.target.value)}
                  onBlur={() => setTouched((prev) => ({ ...prev, customLabel: true }))}
                  placeholder="e.g. Parents' Home, Studio, Gym"
                  className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-[var(--loc-green)] focus:ring-2 focus:ring-[var(--loc-green)]/20 transition-all"
                  aria-label="Custom label name"
                />
                {touched.customLabel && errors.customLabel && (
                  <p className="text-xs text-red-500 mt-1">{errors.customLabel}</p>
                )}
              </div>
            )}

            {/* Existing Home/Work replacement alert */}
            {existingSameLabelAddress && (
              <div className="p-3 bg-amber-50/90 border border-amber-200/80 rounded-xl mt-2 text-amber-900 animate-in fade-in duration-150">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-xs flex-1">
                    <p className="font-semibold">
                      You already have a {label} address saved
                    </p>
                    <p className="text-amber-700 mt-0.5 leading-snug">
                      Saving this will replace your existing {label} address ({existingSameLabelAddress.line1}, {existingSameLabelAddress.area}).
                    </p>
                    {confirmReplace && (
                      <span className="inline-flex items-center gap-1 mt-1.5 text-[11px] font-bold text-amber-900 bg-amber-200/70 px-2 py-0.5 rounded-md">
                        <Check size={12} strokeWidth={3} />
                        Replacement confirmed on save
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Field: House / Flat / Floor / Building (Required) */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
              <span>House / Flat / Floor / Building <span className="text-red-500">*</span></span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
                <Building2 size={16} />
              </div>
              <input
                ref={firstInputRef}
                type="text"
                value={houseFlat}
                onChange={(e) => setHouseFlat(e.target.value)}
                onBlur={() => setTouched((prev) => ({ ...prev, houseFlat: true }))}
                placeholder="e.g. Flat 304, Block C, Maple Heights"
                className="w-full h-11 pl-9 pr-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-[var(--loc-green)] focus:ring-2 focus:ring-[var(--loc-green)]/20 transition-all"
                aria-required="true"
                aria-invalid={Boolean(touched.houseFlat && errors.houseFlat)}
              />
            </div>
            {touched.houseFlat && errors.houseFlat && (
              <p className="text-xs text-red-500 mt-1">{errors.houseFlat}</p>
            )}
          </div>

          {/* Field: Area / Locality (Required, Prefilled) */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
              <span>Area / Locality / Street <span className="text-red-500">*</span></span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
                <Navigation size={16} />
              </div>
              <input
                type="text"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                onBlur={() => setTouched((prev) => ({ ...prev, area: true }))}
                placeholder="e.g. Sector 9, Rohini, Near DC Chowk"
                className="w-full h-11 pl-9 pr-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-[var(--loc-green)] focus:ring-2 focus:ring-[var(--loc-green)]/20 transition-all"
                aria-required="true"
                aria-invalid={Boolean(touched.area && errors.area)}
              />
            </div>
            {touched.area && errors.area && (
              <p className="text-xs text-red-500 mt-1">{errors.area}</p>
            )}
          </div>

          {/* Row: Landmark & Pincode */}
          <div className="grid grid-cols-2 gap-2.5">
            {/* Landmark (Optional) */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 block">
                Landmark <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={landmark}
                onChange={(e) => setLandmark(e.target.value)}
                placeholder="e.g. Opposite Post Office"
                className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-[var(--loc-green)] focus:ring-2 focus:ring-[var(--loc-green)]/20 transition-all"
              />
            </div>

            {/* Pincode (Optional, 6 digits) */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 block">
                Pincode <span className="text-slate-400 font-normal">(6 digits)</span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={pincode}
                onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))}
                onBlur={() => setTouched((prev) => ({ ...prev, pincode: true }))}
                placeholder="e.g. 110085"
                className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-[var(--loc-green)] focus:ring-2 focus:ring-[var(--loc-green)]/20 transition-all"
                aria-invalid={Boolean(touched.pincode && errors.pincode)}
              />
              {touched.pincode && errors.pincode && (
                <p className="text-[11px] text-red-500 mt-0.5">{errors.pincode}</p>
              )}
            </div>
          </div>

          {/* Row: Receiver Name & Phone */}
          <div className="space-y-3 pt-1 border-t border-slate-100">
            {/* Receiver Name */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 block">
                Receiver&apos;s Name <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
                  <User size={16} />
                </div>
                <input
                  type="text"
                  value={receiverName}
                  onChange={(e) => setReceiverName(e.target.value)}
                  placeholder="e.g. Atharv Anand"
                  className="w-full h-11 pl-9 pr-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-[var(--loc-green)] focus:ring-2 focus:ring-[var(--loc-green)]/20 transition-all"
                />
              </div>
            </div>

            {/* Phone (10 digits with +91) */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                <span>Phone number for service <span className="text-red-500">*</span></span>
              </label>
              <div className="flex rounded-xl border border-slate-200 overflow-hidden bg-slate-50 focus-within:bg-white focus-within:border-[var(--loc-green)] focus-within:ring-2 focus-within:ring-[var(--loc-green)]/20 transition-all">
                <span className="flex items-center gap-1.5 px-3 bg-slate-100/90 text-slate-600 text-xs font-semibold border-r border-slate-200 shrink-0 select-none">
                  <Phone size={13} className="text-slate-500" />
                  +91
                </span>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                  onBlur={() => setTouched((prev) => ({ ...prev, phone: true }))}
                  placeholder="98765 43210"
                  className="flex-1 h-11 px-3 bg-transparent text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none"
                  aria-required="true"
                  aria-invalid={Boolean(touched.phone && errors.phone)}
                />
              </div>
              {touched.phone && errors.phone && (
                <p className="text-xs text-red-500 mt-1">{errors.phone}</p>
              )}
            </div>
          </div>

          {/* Sticky Bottom Save Button */}
          <div className="pt-3 pb-6 shrink-0 sticky bottom-0 bg-white">
            <button
              type="submit"
              disabled={!isValid}
              className="w-full h-[52px] rounded-2xl bg-[var(--loc-green)] text-white font-semibold text-[15px] flex items-center justify-center gap-2 shadow-[0_4px_16px_rgba(12,131,31,0.25)] hover:bg-[#0a721b] active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--loc-green)] focus-visible:ring-offset-2"
            >
              <span>
                {existingSameLabelAddress && !confirmReplace
                  ? `Replace existing ${label} & Save`
                  : addressToEdit
                  ? 'Update address'
                  : 'Save address'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(content, portalTarget);
}

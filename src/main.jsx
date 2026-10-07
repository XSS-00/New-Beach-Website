import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  BarChart3,
  Banknote,
  CalendarDays,
  Camera,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Crown,
  Download,
  Eye,
  EyeOff,
  FileText,
  Lock,
  Mail,
  MapPin,
  Menu,
  MessageCircle,
  Minus,
  Palmtree,
  Phone,
  Plus,
  Printer,
  Sailboat,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
  TicketCheck,
  Trash2,
  Umbrella,
  Users,
  Waves,
  X,
} from 'lucide-react';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import {
  BookingProvider,
  TOTAL_SEATS,
  getBookedSeatsForDate,
  isDateFullyBooked,
  isPastDate,
  toDateString,
  useBooking,
  zoneKey,
} from './context/BookingContext';
import { InstallBanner } from './components/InstallBanner';
import AdminSettings from './components/AdminSettings';
import { browserSecurityWarning, createCsrfToken, createReservationCode, isRateLimited, sanitizeInput } from './utils/security';
import { createChargilyCheckout } from './utils/chargily';
import { downloadReceipt } from './utils/receipt';
import './styles.css';

const countries = [
  { code: '+213', label: 'DZ +213' },
  { code: '+33', label: 'FR +33' },
  { code: '+1', label: 'US +1' },
  { code: '+44', label: 'UK +44' },
  { code: '+971', label: 'AE +971' },
  { code: '+212', label: 'MA +212' },
];

const zoneBlueprints = [
  { id: 'bango', place: 'Place 1', name: 'Bango', capacity: 70, remaining: 58, icon: Umbrella, price: 2000, descriptionKey: 'zones.bango', gradient: 'from-white to-sky-50' },
  { id: 'danzo', place: 'Place 2', name: 'Danzo', capacity: 60, remaining: 44, icon: Palmtree, price: 3000, descriptionKey: 'zones.danzo', gradient: 'from-white to-teal-50' },
  { id: 'costa', place: 'Place 3', name: 'Costa Fiesta', capacity: 70, remaining: 40, icon: Crown, price: 4000, vipPrice: 5000, descriptionKey: 'zones.costa', gradient: 'from-white to-amber-50', vip: true },
];

const formatDA = (amount) => `${amount.toLocaleString('en-US')} DA`;

function Root() {
  return (
    <LanguageProvider>
      <BookingProvider>
        <App />
      </BookingProvider>
    </LanguageProvider>
  );
}

function App() {
  const { t, language } = useLanguage();
  const { state, addBooking, updateBooking, cancelBooking: cancelBookingInContext, getZoneRemaining, markAsPaid } = useBooking();
  const [route, setRoute] = useState(window.location.pathname);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [activeZoneId, setActiveZoneId] = useState('bango');
  const [toast, setToast] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const csrfToken = useMemo(() => createCsrfToken(), []);
  const zones = useMemo(
    () =>
      zoneBlueprints.map((zone) => ({
        ...zone,
        price: state.zonePrices[zone.id]?.normal ?? zone.price,
        vipPrice: state.zonePrices[zone.id]?.vip ?? zone.vipPrice,
        remaining: getZoneRemaining(zone.id),
      })),
    [getZoneRemaining, state.zonePrices],
  );

  useEffect(() => {
    browserSecurityWarning();
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js').catch(() => {});
    }
    const onPop = () => setRoute(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const totalRemaining = zones.reduce((sum, zone) => sum + zone.remaining, 0);
  const totalCapacity = zones.reduce((sum, zone) => sum + zone.capacity, 0);

  const openBooking = (zoneId = activeZoneId) => {
    setActiveZoneId(zoneId);
    setConfirmation(null);
    setBookingOpen(true);
  };

  const showToast = (text, type = 'success') => {
    setToast({ type, text });
    window.setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paidCode = params.get('paid');
    const failedCode = params.get('failed');

    if (paidCode) {
      const booking = state.bookings.find((item) => item.code === paidCode);
      markAsPaid(paidCode, 'online');
      if (booking) {
        setActiveZoneId(booking.zone?.id ?? 'bango');
        setConfirmation({ ...booking, paid: true, paymentMethod: 'online' });
        setBookingOpen(true);
      }
      showToast(t('payment.success'));
      window.history.replaceState({}, '', window.location.pathname || '/');
    }

    if (failedCode) {
      showToast(t('payment.error'), 'error');
      window.history.replaceState({}, '', window.location.pathname || '/');
    }
  }, []);

  const confirmBooking = (reservation, options = {}) => {
    const { add = true, update = false, showConfirmation = true } = options;
    if (reservation.csrfToken !== csrfToken) {
      showToast(t('validation.security'), 'error');
      return false;
    }
    if (add && isRateLimited()) {
      showToast(t('validation.rateLimit'), 'error');
      return false;
    }

    if (add) addBooking(reservation);
    if (update) updateBooking(reservation);
    if (showConfirmation) {
      setConfirmation(reservation);
      showToast(t('booking.success'));
    }
    return true;
  };

  const cancelBooking = (code) => {
    cancelBookingInContext(code);
  };

  if (route === '/admin') {
    return (
      <AdminDashboard
        onCancelBooking={cancelBooking}
        onExit={() => {
          window.history.pushState({}, '', '/');
          setRoute('/');
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-appbg font-sans text-ink">
      <div key={language} className="fade-shell">
        <Hero totalRemaining={totalRemaining} totalCapacity={totalCapacity} onBook={() => openBooking('bango')} />
        <AvailabilityStrip zones={zones} />
        <main>
          <ZoneExplorer zones={zones} onReserve={openBooking} />
          <WhySection />
          <FAQSection />
          <ContactSection />
        </main>
        <Footer onBook={() => openBooking('bango')} />
      </div>
      {bookingOpen && (
        <BookingModal
          zones={zones}
          initialZoneId={activeZoneId}
          onClose={() => setBookingOpen(false)}
          onConfirm={confirmBooking}
          confirmation={confirmation}
          csrfToken={csrfToken}
          bookings={state.bookings}
        />
      )}
      {toast && <Toast toast={toast} />}
      <InstallBanner />
    </div>
  );
}

function LanguageToggle({ light = false }) {
  const { language, setLanguage } = useLanguage();
  return (
    <div className={`inline-flex rounded-full border p-1 backdrop-blur ${light ? 'border-slate-200 bg-white' : 'border-white/40 bg-white/15'}`}>
      {['fr', 'en'].map((item) => (
        <button
          key={item}
          onClick={() => setLanguage(item)}
          className={`rounded-full px-3 py-1.5 text-xs font-extrabold transition ${language === item ? 'bg-tealbrand text-white shadow-sm' : light ? 'text-muted hover:bg-slate-100' : 'text-white hover:bg-white/15'}`}
        >
          {item.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

function Hero({ totalRemaining, totalCapacity, onBook }) {
  const { t } = useLanguage();
  const percentage = Math.round((totalRemaining / totalCapacity) * 100);

  return (
    <header className="relative overflow-hidden bg-gradient-to-br from-sky-600 via-teal-400 to-white">
      <nav className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <a href="#" className="flex items-center gap-3 font-extrabold text-white">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/95 text-skybrand shadow-soft">
            <Waves size={23} />
          </span>
          <span className="text-lg tracking-normal">New Beach Oran</span>
        </a>
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-8 text-sm font-semibold text-white/90 md:flex">
            <a href="#zones" className="hover:text-white">{t('nav.zones')}</a>
            <a href="#why" className="hover:text-white">{t('nav.why')}</a>
            <a href="#faq" className="hover:text-white">{t('nav.faq')}</a>
            <a href="#contact" className="hover:text-white">{t('nav.contact')}</a>
            <button onClick={onBook} className="rounded-full bg-white px-5 py-2.5 text-sky-700 shadow-soft transition hover:-translate-y-0.5 hover:bg-sky-50">
              {t('nav.book')}
            </button>
          </div>
          <LanguageToggle />
        </div>
      </nav>
      <div className="relative z-10 w-full" aria-hidden="true">
        <div
          className="mx-auto max-w-7xl px-5 sm:px-8"
          style={{
            height: '1.5px',
            background:
              'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.55) 20%, rgba(255,255,255,0.85) 50%, rgba(255,255,255,0.55) 80%, transparent 100%)',
            borderRadius: '999px',
          }}
        />
      </div>

      <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-10 px-5 pb-24 pt-10 sm:px-8 lg:grid-cols-[1.05fr_.95fr] lg:pb-32 lg:pt-16">
        <section className="max-w-3xl">
          <span className="inline-flex animate-[fadeSlide_500ms_ease-out_100ms_both] items-center gap-2 rounded-full border border-white/45 bg-white/20 px-4 py-2 text-sm font-semibold text-white shadow-sm backdrop-blur">
            <Sun size={17} /> {t('hero.badge')}
          </span>
          <p
            className="mt-7 animate-[fadeSlide_650ms_ease-out_0ms_both] text-center text-4xl font-extrabold italic tracking-wide md:text-6xl"
            style={{
              background: 'linear-gradient(90deg, #ffffff 0%, #7dd3fc 40%, #2dd4bf 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              filter: 'drop-shadow(0 2px 12px rgba(14,165,233,0.35))',
            }}
          >
            {t('hero.tagline')}
          </p>
          <h1 className="mt-4 animate-[fadeSlide_650ms_ease-out_200ms_both] text-3xl font-extrabold leading-tight tracking-normal text-ink drop-shadow-sm sm:text-5xl">
            {t('hero.title')}
          </h1>
          <p className="mt-6 max-w-2xl animate-[fadeSlide_650ms_ease-out_400ms_both] text-base leading-8 text-white/90 sm:text-lg">
            {t('hero.subtitle')}
          </p>
          <div className="mt-8 flex animate-[fadeSlide_650ms_ease-out_600ms_both] flex-col gap-3 sm:flex-row">
            <button onClick={onBook} className="inline-flex items-center justify-center gap-2 rounded-full bg-skybrand px-7 py-4 text-sm font-bold text-white shadow-glow transition hover:-translate-y-0.5 hover:bg-sky-600">
              <TicketCheck size={18} /> {t('nav.book')}
            </button>
            <a href="#zones" className="inline-flex items-center justify-center gap-2 rounded-full border border-teal-100 bg-white/15 px-7 py-4 text-sm font-bold text-white backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/25">
              {t('hero.explore')} <ChevronRight size={18} />
            </a>
          </div>
        </section>

        <section className="relative min-h-[330px]">
          <div className="absolute right-0 top-0 z-20 animate-float rounded-3xl border border-white/70 bg-white/90 px-5 py-4 shadow-soft backdrop-blur">
            <div className="flex items-center gap-3">
              <span className="h-3 w-3 rounded-full bg-emerald-500 shadow-[0_0_0_6px_rgba(16,185,129,.16)]" />
              <div>
                <p className="text-sm font-extrabold text-ink">{totalRemaining} {t('hero.available')}</p>
                <p className="text-xs font-semibold text-muted">{percentage}% {t('hero.capacity')}</p>
              </div>
            </div>
          </div>
          <div className="relative ml-auto mt-10 max-w-[520px] rounded-[2rem] border border-white/55 bg-white/30 p-3 shadow-soft backdrop-blur">
            <div className="overflow-hidden rounded-[1.5rem] bg-slate-950">
              <img src="/costa-fiesta-logo.jpg" alt="Costa Fiesta Beach Club" className="h-72 w-full object-contain p-10 sm:h-96" />
            </div>
          </div>
          <div className="absolute bottom-2 left-3 rounded-3xl border border-white/65 bg-white/90 p-4 shadow-soft backdrop-blur">
            <p className="text-xs font-bold uppercase text-muted">{t('hero.totalCapacity')}</p>
            <p className="mt-1 text-2xl font-extrabold text-ink">200 seats</p>
          </div>
        </section>
      </div>

      <svg className="absolute bottom-0 left-0 h-20 w-full text-appbg" viewBox="0 0 1440 120" preserveAspectRatio="none" aria-hidden="true">
        <path fill="currentColor" d="M0,68 C170,112 296,92 437,61 C617,22 748,10 920,50 C1104,93 1266,111 1440,70 L1440,120 L0,120 Z" />
      </svg>
    </header>
  );
}

function AvailabilityStrip({ zones }) {
  const { t } = useLanguage();
  return (
    <section className="relative z-20 mx-auto -mt-8 max-w-7xl px-5 sm:px-8">
      <div className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-3 shadow-soft md:grid-cols-3">
        {zones.map((zone) => {
          const Icon = zone.icon;
          const status = getStatus(zone, t);
          return (
            <div key={zone.id} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white text-skybrand shadow-sm">
                  <Icon size={20} />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold text-ink">{zone.name}</p>
                  <p className="text-xs font-semibold text-muted">{zone.remaining} {t('availability.seatsLeft')}</p>
                </div>
              </div>
              <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${status.className}`}>{status.label}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ZoneExplorer({ zones, onReserve }) {
  const { t } = useLanguage();
  return (
    <section id="zones" className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
      <div>
        <p className="text-sm font-extrabold uppercase text-tealbrand">{t('zones.eyebrow')}</p>
        <h2 className="mt-3 text-3xl font-extrabold tracking-normal text-ink sm:text-4xl">{t('zones.title')}</h2>
        <p className="mt-4 max-w-2xl text-base leading-7 text-muted">{t('zones.intro')}</p>
      </div>
      <div className="mt-10 grid gap-5 lg:grid-cols-3">
        {zones.map((zone) => <ZoneCard key={zone.id} zone={zone} onReserve={() => onReserve(zone.id)} />)}
      </div>
    </section>
  );
}

function ZoneCard({ zone, onReserve }) {
  const { t } = useLanguage();
  const Icon = zone.icon;
  const used = zone.capacity - zone.remaining;
  const usedPercent = Math.round((used / zone.capacity) * 100);
  return (
    <article className={`group relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br ${zone.gradient} p-6 shadow-soft transition duration-300 hover:-translate-y-1 hover:border-tealbrand/55 hover:shadow-glow`}>
      {zone.vip && <div className="absolute right-5 top-5 rounded-full bg-vip px-3 py-1 text-xs font-extrabold text-white shadow-sm">{t('zones.vip')}</div>}
      <div className="flex items-start justify-between gap-4">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white text-skybrand shadow-sm transition group-hover:text-tealbrand">
          <Icon size={27} />
        </div>
        <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-bold text-white">{zone.place}</span>
      </div>
      <h3 className="mt-6 text-2xl font-extrabold text-ink">{zone.name}</h3>
      <p className="mt-3 min-h-[78px] text-sm leading-7 text-muted">{t(zone.descriptionKey)}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <PriceBadge label={zone.vip ? t('zones.normal') : t('zones.seat')} price={zone.price} />
        {zone.vip && <PriceBadge label={t('zones.vip')} price={zone.vipPrice} vip />}
      </div>
      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between text-xs font-bold text-muted">
          <span>{used} {t('zones.used')}</span>
          <span>{zone.remaining} {t('zones.available')}</span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-gradient-to-r from-skybrand to-tealbrand transition-all duration-500" style={{ width: `${usedPercent}%` }} />
        </div>
      </div>
      <button onClick={onReserve} disabled={zone.remaining === 0} className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-full bg-skybrand px-5 py-3 text-sm font-extrabold text-white shadow-sm transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:bg-slate-300">
        {t('zones.reserve')} <ChevronRight size={18} />
      </button>
    </article>
  );
}

function PriceBadge({ label, price, vip = false }) {
  const { t } = useLanguage();
  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-extrabold ${vip ? 'border-amber-200 bg-amber-100 text-amber-700' : 'border-sky-100 bg-sky-50 text-sky-700'}`}>
      {label}: {formatDA(price)} / {t('zones.perPerson')}
    </span>
  );
}

function BookingModal({ zones, initialZoneId, onClose, onConfirm, confirmation, csrfToken, bookings }) {
  const { t, language } = useLanguage();
  const [step, setStep] = useState(1);
  const [reservationDraft, setReservationDraft] = useState(null);
  const [form, setForm] = useState({
    zoneId: initialZoneId,
    people: 2,
    seatType: 'Normal',
    date: '',
    fullName: '',
    email: '',
    phoneCode: '+213',
    phone: '',
    honeypot: '',
  });
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const selectedZone = zones.find((zone) => zone.id === form.zoneId) ?? zones[0];
  const unitPrice = selectedZone.vip && form.seatType === 'VIP' ? selectedZone.vipPrice : selectedZone.price;
  const total = unitPrice * form.people;
  const errors = getFormErrors(form, selectedZone, t, bookings);
  const canBook = form.people <= selectedZone.remaining;
  const chargilyEnabled = localStorage.getItem('nbo_chargily_enabled') === 'true';

  const updateForm = (patch) => {
    setError('');
    const sanitizedPatch = Object.fromEntries(
      Object.entries(patch).map(([key, value]) => [key, typeof value === 'string' ? sanitizeInput(value) : value]),
    );
    setForm((current) => ({ ...current, ...sanitizedPatch }));
  };

  const markTouched = (field) => setTouched((current) => ({ ...current, [field]: true }));
  const stepValid = isStepValid(step, errors);

  const goNext = () => {
    setSubmitted(true);
    if (!stepValid) return;
    setSubmitted(false);
    setStep((current) => Math.min(5, current + 1));
  };

  const buildReservation = (paymentMethod = 'pending') => {
    const phone = form.phone ? `${form.phoneCode} ${form.phone}` : '';
    return {
      code: reservationDraft?.code ?? createReservationCode(),
      zone: selectedZone,
      people: form.people,
      seatType: selectedZone.vip ? form.seatType : 'Standard',
      date: toDateString(new Date(`${form.date}T00:00:00`)),
      fullName: form.fullName.trim(),
      email: form.email.trim(),
      phone,
      unitPrice,
      total,
      paid: false,
      paymentMethod,
      timestamp: reservationDraft?.timestamp ?? new Date().toISOString(),
      csrfToken,
    };
  };

  const submit = () => {
    setSubmitted(true);
    if (!stepValid) return;
    if (form.honeypot) return;
    const reservation = buildReservation();
    const ok = reservationDraft
      ? onConfirm(reservation, { add: false, update: true, showConfirmation: false })
      : onConfirm(reservation, { showConfirmation: false });
    if (ok) {
      setReservationDraft(reservation);
      setSubmitted(false);
      setStep(5);
    }
    if (!ok) setError(t('validation.rateLimit'));
  };

  const confirmCashPayment = () => {
    const reservation = { ...(reservationDraft ?? buildReservation()), paymentMethod: 'cash', paid: false };
    onConfirm(reservation, { add: false, update: true, showConfirmation: true });
  };

  const prepareOnlinePayment = () => {
    const reservation = { ...(reservationDraft ?? buildReservation()), paymentMethod: 'online', paid: false };
    setReservationDraft(reservation);
    return onConfirm(reservation, { add: false, update: true, showConfirmation: false });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-sm sm:items-center sm:p-5">
      <div className="max-h-[96vh] w-full max-w-4xl overflow-hidden rounded-t-[2rem] border border-slate-200 bg-white shadow-2xl sm:rounded-[2rem]">
        <div className="no-print flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-7">
          <div>
            <p className="text-xs font-extrabold uppercase text-tealbrand">{confirmation ? t('booking.confirmed') : `${t('booking.step')} ${step} / 5`}</p>
            <h2 className="text-xl font-extrabold text-ink">{t('booking.title')}</h2>
          </div>
          <button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200" aria-label={t('booking.close')}>
            <X size={19} />
          </button>
        </div>
        {!confirmation && <ProgressDots step={step} />}
        <div className="max-h-[calc(96vh-120px)] overflow-y-auto p-5 sm:p-7">
          {confirmation ? (
            <Confirmation reservation={confirmation} onClose={onClose} />
          ) : (
            <>
              <div className="animate-fadeSlide">
                {step === 1 && <ChooseZone zones={zones} form={form} updateForm={updateForm} />}
                {step === 2 && <SeatDetails selectedZone={selectedZone} form={form} updateForm={updateForm} errors={errors} touched={touched} submitted={submitted} markTouched={markTouched} bookings={bookings} />}
                {step === 3 && <PersonalInfo form={form} updateForm={updateForm} errors={errors} touched={touched} submitted={submitted} markTouched={markTouched} />}
                {step === 4 && <Summary selectedZone={selectedZone} form={form} unitPrice={unitPrice} total={total} />}
                {step === 5 && <PaymentStep total={total} reservationDraft={reservationDraft} onPayCash={confirmCashPayment} onPayOnline={prepareOnlinePayment} chargilyEnabled={chargilyEnabled} language={language} />}
              </div>
              {error && <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>}
              <input className="honeypot" tabIndex="-1" autoComplete="off" value={form.honeypot} onChange={(event) => updateForm({ honeypot: event.target.value })} aria-hidden="true" />
              <div className="mt-7 flex items-center justify-between gap-3">
                <button onClick={() => (step === 1 ? onClose() : setStep((current) => current - 1))} className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-5 py-3 text-sm font-extrabold text-slate-700 transition hover:bg-slate-50">
                  <ChevronLeft size={18} /> {step === 1 ? t('booking.cancel') : t('booking.back')}
                </button>
                {step < 4 ? (
                  <button onClick={goNext} disabled={!stepValid} className="inline-flex items-center gap-2 rounded-full bg-skybrand px-6 py-3 text-sm font-extrabold text-white shadow-sm transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:bg-slate-300">
                    {t('booking.continue')} <ChevronRight size={18} />
                  </button>
                ) : step === 4 ? (
                  <button onClick={submit} disabled={!canBook} className="inline-flex items-center gap-2 rounded-full bg-skybrand px-6 py-3 text-sm font-extrabold text-white shadow-sm transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:bg-slate-300">
                    {t('booking.confirm')} <Check size={18} />
                  </button>
                ) : <span />}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function getFormErrors(form, selectedZone, t, bookings) {
  const errors = {};
  if (!form.zoneId) errors.zoneId = t('validation.zone');
  if (form.people < 1) errors.people = t('validation.people');
  if (form.people > selectedZone.remaining) errors.people = t('validation.overbooked');
  if (!form.date) errors.date = t('validation.date');
  if (form.date && isPastDate(form.date)) errors.date = t('validation.pastDate');
  if (form.date && isDateFullyBooked(new Date(`${form.date}T00:00:00`), bookings, TOTAL_SEATS)) errors.date = t('validation.blockedDate');
  if (!form.fullName.trim()) errors.fullName = t('validation.required');
  if (form.fullName.trim() && form.fullName.trim().length < 3) errors.fullName = t('validation.minName');
  if (!form.email.trim()) errors.email = t('validation.required');
  if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = t('validation.email');
  if (form.phone && !/^[+]?[\d\s().-]{6,24}$/.test(`${form.phoneCode} ${form.phone}`)) errors.phone = t('validation.phone');
  return errors;
}

function isStepValid(step, errors) {
  if (step === 1) return !errors.zoneId;
  if (step === 2) return !errors.people && !errors.date;
  if (step === 3) return !errors.fullName && !errors.email && !errors.phone;
  if (step === 4) return Object.keys(errors).length === 0;
  return true;
}

function PaymentStep({ total, reservationDraft, onPayCash, onPayOnline, chargilyEnabled, language }) {
  const { t } = useLanguage();
  const [processing, setProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState('');

  const handleOnlinePayment = async () => {
    setPaymentError('');
    setProcessing(true);
    try {
      const apiKey = localStorage.getItem('nbo_chargily_api_key');
      const prepared = onPayOnline();
      if (!prepared) throw new Error('Reservation could not be prepared');
      const checkout = await createChargilyCheckout({
        apiKey,
        amount: total,
        reservationCode: reservationDraft.code,
        customerName: reservationDraft.fullName,
        customerEmail: reservationDraft.email,
        successUrl: `${window.location.origin}/?paid=${reservationDraft.code}`,
        failureUrl: `${window.location.origin}/?failed=${reservationDraft.code}`,
        locale: language,
      });
      window.location.href = checkout.checkout_url;
    } catch {
      setProcessing(false);
      setPaymentError(t('payment.error'));
    }
  };

  return (
    <section>
      <h3 className="text-2xl font-extrabold text-ink">{t('payment.title')}</h3>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <button
          onClick={onPayCash}
          className="rounded-2xl border-2 border-slate-200 bg-white p-6 text-left transition hover:-translate-y-0.5 hover:border-tealbrand"
        >
          <Banknote className="text-emerald-500" size={34} />
          <p className="mt-3 text-lg font-extrabold text-ink">{t('payment.cash')}</p>
          <p className="mt-1 text-sm text-muted">{t('payment.cashHelper')}</p>
        </button>
        {chargilyEnabled && (
          <button
            onClick={handleOnlinePayment}
            disabled={processing}
            className="rounded-2xl border-2 border-tealbrand bg-teal-50 p-6 text-left transition hover:-translate-y-0.5 disabled:opacity-60"
          >
            <CreditCard className="text-tealbrand" size={34} />
            <p className="mt-3 text-lg font-extrabold text-ink">{t('payment.online')}</p>
            <p className="mt-1 text-sm text-muted">{t('payment.onlineHelper')}</p>
            {processing && <p className="mt-2 text-xs font-bold text-tealbrand">{t('payment.redirecting')}</p>}
          </button>
        )}
      </div>
      {paymentError && <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{paymentError}</p>}
    </section>
  );
}

function FieldError({ show, message }) {
  if (!show || !message) return null;
  return <p className="mt-2 text-xs font-bold text-rose-600">{message}</p>;
}

function ProgressDots({ step }) {
  return <div className="no-print grid grid-cols-5 gap-2 px-5 pt-4 sm:px-7">{[1, 2, 3, 4, 5].map((item) => <div key={item} className={`h-2 rounded-full transition-all ${item <= step ? 'bg-gradient-to-r from-skybrand to-tealbrand' : 'bg-slate-200'}`} />)}</div>;
}

function ChooseZone({ zones, form, updateForm }) {
  const { t } = useLanguage();
  return (
    <section>
      <h3 className="text-2xl font-extrabold text-ink">{t('booking.chooseZone')}</h3>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {zones.map((zone) => {
          const Icon = zone.icon;
          const selected = form.zoneId === zone.id;
          return (
            <button key={zone.id} onClick={() => updateForm({ zoneId: zone.id, seatType: 'Normal' })} className={`rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 ${selected ? 'border-tealbrand bg-teal-50 shadow-glow' : 'border-slate-200 bg-white hover:border-sky-200'}`}>
              <div className="flex items-center justify-between gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-sky-50 text-skybrand"><Icon size={22} /></span>
                <span className={`grid h-6 w-6 place-items-center rounded-full border ${selected ? 'border-tealbrand bg-tealbrand text-white' : 'border-slate-300'}`}>{selected && <Check size={14} />}</span>
              </div>
              <p className="mt-4 text-lg font-extrabold text-ink">{zone.name}</p>
              <p className="mt-1 text-sm font-semibold text-muted">{zone.remaining} {t('zones.available')}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function SeatDetails({ selectedZone, form, updateForm, errors, touched, submitted, markTouched, bookings }) {
  const { t } = useLanguage();
  const todayString = toDateString(new Date());
  const selectedDateSeats = form.date ? getBookedSeatsForDate(new Date(`${form.date}T00:00:00`), bookings) : 0;
  return (
    <section>
      <h3 className="text-2xl font-extrabold text-ink">{t('booking.seatDetails')}</h3>
      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <label className="text-sm font-extrabold text-ink">{t('booking.people')}</label>
          <div className="mt-4 flex items-center justify-between rounded-full bg-white p-2 shadow-sm">
            <button onClick={() => updateForm({ people: Math.max(1, form.people - 1) })} className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-700 transition hover:bg-slate-200" aria-label="Decrease">
              <Minus size={17} />
            </button>
            <span className={`text-2xl font-extrabold transition ${errors.people ? 'text-rose-600' : 'text-ink'}`}>{form.people}</span>
            <button onClick={() => updateForm({ people: form.people + 1 })} className="grid h-10 w-10 place-items-center rounded-full bg-skybrand text-white transition hover:bg-sky-600" aria-label="Increase">
              <Plus size={17} />
            </button>
          </div>
          <p className="mt-3 text-sm font-semibold text-muted">{selectedZone.remaining} {t('booking.seatsRemainIn')} {selectedZone.name}</p>
          <FieldError show={submitted} message={errors.people} />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <label className="text-sm font-extrabold text-ink">{t('booking.preferredDate')}</label>
          <div className="relative mt-4">
            <CalendarDays className="pointer-events-none absolute left-4 top-3.5 text-muted" size={18} />
            <input type="date" min={todayString} value={form.date} onBlur={() => markTouched('date')} onChange={(event) => updateForm({ date: event.target.value })} className="h-12 w-full rounded-full border border-slate-200 bg-white pl-11 pr-4 text-sm font-semibold text-ink outline-none transition focus:border-tealbrand focus:ring-4 focus:ring-teal-100" title={form.date ? `${selectedDateSeats} / ${TOTAL_SEATS} ${t('booking.seatsTaken')}` : ''} />
          </div>
          {form.date && <p className="mt-3 rounded-full bg-sky-50 px-3 py-2 text-xs font-extrabold text-sky-700">{selectedDateSeats} / {TOTAL_SEATS} {t('booking.seatsTaken')}</p>}
          <FieldError show={submitted || touched.date} message={errors.date} />
        </div>
      </div>
      {selectedZone.vip && (
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-extrabold text-ink">{t('booking.seatType')}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {['Normal', 'VIP'].map((type) => <button key={type} onClick={() => updateForm({ seatType: type })} className={`rounded-2xl border px-4 py-4 text-left font-extrabold transition ${form.seatType === type ? 'border-vip bg-white text-amber-700 shadow-sm' : 'border-amber-100 bg-white/55 text-slate-700'}`}>{type}<span className="block text-sm font-semibold text-muted">{formatDA(type === 'VIP' ? selectedZone.vipPrice : selectedZone.price)} / {t('zones.perPerson')}</span></button>)}
          </div>
        </div>
      )}
    </section>
  );
}

function PersonalInfo({ form, updateForm, errors, touched, submitted, markTouched }) {
  const { t } = useLanguage();
  return (
    <section>
      <h3 className="text-2xl font-extrabold text-ink">{t('booking.personalInfo')}</h3>
      <div className="mt-5 grid gap-4">
        <TextInput label={t('booking.fullName')} value={form.fullName} onBlur={() => markTouched('fullName')} onChange={(value) => updateForm({ fullName: value })} placeholder={t('booking.fullName')} error={errors.fullName} showError={submitted || touched.fullName} />
        <TextInput label={t('booking.email')} value={form.email} onBlur={() => markTouched('email')} onChange={(value) => updateForm({ email: value })} placeholder="you@example.com" type="email" error={errors.email} showError={submitted || touched.email} />
        <div>
          <span className="text-sm font-extrabold text-ink">{t('booking.phone')}</span>
          <div className="mt-2 grid gap-2 sm:grid-cols-[150px_1fr]">
            <select value={form.phoneCode} onChange={(event) => updateForm({ phoneCode: event.target.value })} className="h-12 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-ink outline-none focus:border-tealbrand focus:ring-4 focus:ring-teal-100">
              {countries.map((country) => <option key={country.code} value={country.code}>{country.label}</option>)}
            </select>
            <input value={form.phone} onBlur={() => markTouched('phone')} onChange={(event) => updateForm({ phone: event.target.value })} placeholder="+33 6 12 34 56 78" className="h-12 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-ink outline-none transition placeholder:text-slate-400 focus:border-tealbrand focus:ring-4 focus:ring-teal-100" />
          </div>
          <p className="mt-2 text-xs font-semibold text-muted">{t('booking.phoneHelper')}</p>
          <FieldError show={submitted || touched.phone} message={errors.phone} />
        </div>
      </div>
    </section>
  );
}

function TextInput({ label, value, onChange, onBlur, placeholder, type = 'text', error, showError }) {
  return (
    <label className="block">
      <span className="text-sm font-extrabold text-ink">{label}</span>
      <input type={type} value={value} onBlur={onBlur} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-2 h-12 w-full rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-ink outline-none transition placeholder:text-slate-400 focus:border-tealbrand focus:ring-4 focus:ring-teal-100" />
      <FieldError show={showError} message={error} />
    </label>
  );
}

function Summary({ selectedZone, form, unitPrice, total }) {
  const { t } = useLanguage();
  return (
    <section>
      <h3 className="text-2xl font-extrabold text-ink">{t('booking.summaryTitle')}</h3>
      <div className="mt-5 rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-sky-50 p-5 shadow-soft">
        <SummaryRow label={t('booking.zone')} value={`${selectedZone.place} - ${selectedZone.name}`} />
        <SummaryRow label={t('booking.date')} value={form.date || '-'} />
        <SummaryRow label={t('booking.seats')} value={`${form.people}`} />
        <SummaryRow label={t('booking.type')} value={selectedZone.vip ? form.seatType : 'Standard'} />
        <div className="my-4 h-px bg-slate-200" />
        <SummaryRow label={t('booking.unitPrice')} value={formatDA(unitPrice)} />
        <SummaryRow label={t('booking.total')} value={formatDA(total)} strong />
      </div>
    </section>
  );
}

function SummaryRow({ label, value, strong = false }) {
  return <div className="flex items-center justify-between gap-4 py-2"><span className="text-sm font-semibold text-muted">{label}</span><span className={`${strong ? 'text-xl text-skybrand' : 'text-sm text-ink'} text-right font-extrabold`}>{value}</span></div>;
}

function Confirmation({ reservation, onClose }) {
  const { t } = useLanguage();
  const paymentLabel = reservation.paymentMethod === 'online' || reservation.paid ? t('payment.onlineReceipt') : t('payment.cashReceipt');
  return (
    <section className="print-receipt animate-pop text-center">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-emerald-600"><Check size={30} /></div>
      <h3 className="mt-5 text-3xl font-extrabold text-ink">{t('booking.reservationConfirmed')}</h3>
      <p className="mt-2 text-sm font-semibold text-muted">{t('booking.codeText')}</p>
      <p className="mt-3 inline-flex rounded-full bg-slate-900 px-5 py-2 text-xl font-extrabold text-white">{reservation.code}</p>
      <div className="mx-auto mt-6 max-w-xl rounded-3xl border border-slate-200 bg-slate-50 p-5 text-left">
        <SummaryRow label={t('booking.fullName')} value={reservation.fullName} />
        <SummaryRow label={t('booking.email')} value={reservation.email} />
        <SummaryRow label={t('booking.phone')} value={reservation.phone || '-'} />
        <SummaryRow label={t('booking.zone')} value={reservation.zone.name} />
        <SummaryRow label={t('booking.date')} value={reservation.date} />
        <SummaryRow label={t('booking.seats')} value={`${reservation.people}`} />
        <SummaryRow label={t('booking.type')} value={reservation.seatType} />
        <SummaryRow label={t('payment.label')} value={paymentLabel} />
        <SummaryRow label={t('booking.total')} value={formatDA(reservation.total)} strong />
      </div>
      <div className="no-print mt-7 flex flex-col justify-center gap-3 sm:flex-row">
        <button onClick={() => downloadReceipt(reservation)} className="inline-flex items-center justify-center gap-2 rounded-full border border-tealbrand px-6 py-3 text-sm font-extrabold text-tealbrand transition hover:bg-teal-50">
          <Download size={18} /> {t('booking.downloadReceipt')}
        </button>
        <button onClick={() => window.print()} className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 px-6 py-3 text-sm font-extrabold text-slate-700 transition hover:bg-slate-50">
          <Printer size={18} /> {t('booking.printReceipt')}
        </button>
        <button onClick={onClose} className="rounded-full bg-skybrand px-7 py-3 text-sm font-extrabold text-white shadow-sm transition hover:bg-sky-600">{t('booking.done')}</button>
      </div>
    </section>
  );
}

function WhySection() {
  const { t } = useLanguage();
  const features = [
    { icon: MapPin, title: t('why.premium'), text: t('why.premiumText') },
    { icon: TicketCheck, title: t('why.booking'), text: t('why.bookingText') },
    { icon: Sparkles, title: t('why.pricing'), text: t('why.pricingText') },
    { icon: ShieldCheck, title: t('why.guaranteed'), text: t('why.guaranteedText') },
  ];
  return (
    <section id="why" className="bg-white py-20">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <p className="text-sm font-extrabold uppercase text-tealbrand">{t('why.eyebrow')}</p>
        <h2 className="mt-3 text-3xl font-extrabold tracking-normal text-ink sm:text-4xl">{t('why.title')}</h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{features.map((feature) => { const Icon = feature.icon; return <article key={feature.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-teal-50 text-tealbrand"><Icon size={23} /></span><h3 className="mt-5 text-lg font-extrabold text-ink">{feature.title}</h3><p className="mt-2 text-sm leading-6 text-muted">{feature.text}</p></article>; })}</div>
      </div>
    </section>
  );
}

function FAQSection() {
  const { t } = useLanguage();
  const [openIndex, setOpenIndex] = useState(0);
  const faqs = [['faq.q1', 'faq.a1'], ['faq.q2', 'faq.a2'], ['faq.q3', 'faq.a3'], ['faq.q4', 'faq.a4'], ['faq.q5', 'faq.a5'], ['faq.q6', 'faq.a6']];
  return (
    <section id="faq" className="mx-auto max-w-4xl px-5 py-20 sm:px-8">
      <div className="text-center"><p className="text-sm font-extrabold uppercase text-tealbrand">{t('faq.eyebrow')}</p><h2 className="mt-3 text-3xl font-extrabold text-ink sm:text-4xl">{t('faq.title')}</h2></div>
      <div className="mt-10 space-y-3">{faqs.map(([question, answer], index) => { const isOpen = openIndex === index; return <article key={question} className="rounded-2xl border border-slate-200 bg-white shadow-sm"><button onClick={() => setOpenIndex(isOpen ? -1 : index)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"><span className="font-extrabold text-ink">{t(question)}</span><ChevronDown className={`shrink-0 text-muted transition ${isOpen ? 'rotate-180' : ''}`} size={19} /></button>{isOpen && <p className="px-5 pb-5 text-sm leading-7 text-muted">{t(answer)}</p>}</article>; })}</div>
    </section>
  );
}

function ContactSection() {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const target = document.getElementById('contact-card');
    if (!target) return undefined;
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && setVisible(true), { threshold: 0.2 });
    observer.observe(target);
    return () => observer.disconnect();
  }, []);
  const contacts = [
    { icon: Camera, label: t('contact.instagram'), value: '@costafiestabynb', href: 'https://www.instagram.com/costafiestabynb' },
    { icon: Phone, label: t('contact.phone'), value: '0560 33 79 91', href: 'tel:0560337991' },
    { icon: Mail, label: t('contact.email'), value: 'costafiesta748@gmail.com', href: 'mailto:costafiesta748@gmail.com' },
    { icon: Users, label: t('contact.facebook'), value: 'Costa Fiesta By Plaza New Beach', href: 'https://www.facebook.com/search/top?q=Costa%20Fiesta%20By%20Plaza%20New%20Beach' },
  ];
  return (
    <section id="contact" className="mx-auto max-w-7xl px-5 pb-20 sm:px-8">
      <div id="contact-card" className={`scroll-fade rounded-[2rem] border border-slate-200 bg-gradient-to-br from-teal-50 via-white to-sky-50 p-6 shadow-soft sm:p-8 ${visible ? 'is-visible' : ''}`}>
        <h2 className="text-3xl font-extrabold text-ink">{t('contact.title')}</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{contacts.map((item) => { const Icon = item.icon; return <a key={item.label} href={item.href} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-tealbrand/55 hover:shadow-glow"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-teal-50 text-tealbrand"><Icon size={21} /></span><p className="mt-4 text-sm font-extrabold text-muted">{item.label}</p><p className="mt-1 break-words text-sm font-extrabold text-ink">{item.value}</p></a>; })}</div>
      </div>
    </section>
  );
}

function Footer({ onBook }) {
  const { t } = useLanguage();
  return (
    <footer className="border-t border-slate-200 bg-slate-950 text-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-12 sm:px-8 md:grid-cols-[1.2fr_.8fr_.8fr]">
        <div><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-skybrand"><Waves size={22} /></span><div><p className="font-extrabold">New Beach Oran</p><p className="text-sm text-slate-300">{t('footer.tagline')}</p></div></div></div>
        <div><p className="font-extrabold">{t('footer.quick')}</p><div className="mt-3 grid gap-2 text-sm text-slate-300"><a href="#zones" className="hover:text-white">{t('nav.zones')}</a><button onClick={onBook} className="w-fit hover:text-white">{t('nav.book')}</button><a href="#faq" className="hover:text-white">{t('nav.faq')}</a><a href="#contact" className="hover:text-white">{t('nav.contact')}</a></div></div>
        <div><p className="font-extrabold">{t('contact.title')}</p><p className="mt-3 flex items-center gap-2 text-sm text-slate-300"><MapPin size={17} /> {t('footer.location')}</p><div className="mt-5 flex gap-3"><a href="https://www.instagram.com/costafiestabynb" aria-label="Instagram" className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"><Camera size={18} /></a><a href="mailto:costafiesta748@gmail.com" aria-label="Email" className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"><Mail size={18} /></a><a href="https://www.facebook.com/search/top?q=Costa%20Fiesta%20By%20Plaza%20New%20Beach" aria-label="Facebook" className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"><MessageCircle size={18} /></a><a href="#" aria-label="Beach updates" className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"><Sailboat size={18} /></a></div></div>
      </div>
      <div className="border-t border-white/10 bg-slate-900 px-5 py-4">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 text-sm font-semibold text-slate-400 sm:flex-row">
          <p>{t('footer.credit')}</p>
          <div className="flex items-center gap-3"><a href="tel:0794280809" className="text-slate-400 hover:text-tealbrand"><Phone size={17} /></a><a href="https://www.linkedin.com/search/results/all/?keywords=Yacine%20ASSIA" className="text-slate-400 hover:text-tealbrand"><Users size={17} /></a><a href="mailto:y_assia@outlook.fr" className="text-slate-400 hover:text-tealbrand"><Mail size={17} /></a></div>
        </div>
      </div>
      <div className="border-t border-white/10 px-5 py-5 text-center text-xs font-semibold text-slate-400">{t('footer.copyright')}</div>
    </footer>
  );
}

function Toast({ toast }) {
  const isError = toast.type === 'error';
  return <div className={`fixed right-5 top-5 z-[60] animate-pop rounded-2xl border bg-white px-5 py-4 text-sm font-extrabold shadow-soft ${isError ? 'border-rose-200 text-rose-700' : 'border-emerald-200 text-emerald-700'}`}>{toast.text}</div>;
}

function getStoredAdminPassword() {
  const saved = localStorage.getItem('nbo_admin_password');
  if (saved) return saved;
  localStorage.setItem('nbo_admin_password', 'newbeach2025');
  return 'newbeach2025';
}

function AdminDashboard({ onCancelBooking, onExit }) {
  const { t } = useLanguage();
  const { state, getZoneRemaining, markAsPaid } = useBooking();
  const [authenticated, setAuthenticated] = useState(
    () => sessionStorage.getItem('nbo_admin_auth') === 'true',
  );
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [query, setQuery] = useState('');
  const [zoneFilter, setZoneFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [adminToast, setAdminToast] = useState('');
  const bookings = state.bookings;
  const zones = zoneBlueprints.map((zone) => ({ ...zone, remaining: getZoneRemaining(zone.id) }));
  const seatsBooked = bookings.reduce((sum, item) => sum + item.people, 0);
  const revenue = bookings.reduce((sum, item) => sum + item.total, 0);
  const remaining = state.totalSeats - seatsBooked;
  const filtered = bookings.filter((booking) => {
    const search = query.toLowerCase();
    const matchesSearch = !search || [booking.code, booking.fullName, booking.email].some((value) => value.toLowerCase().includes(search));
    const matchesZone = !zoneFilter || booking.zone.id === zoneFilter;
    const matchesDate = !dateFilter || booking.date === dateFilter;
    return matchesSearch && matchesZone && matchesDate;
  });
  const showAdminToast = (text) => {
    setAdminToast(text);
    window.setTimeout(() => setAdminToast(''), 3500);
  };

  const login = (event) => {
    event.preventDefault();
    const storedPassword = localStorage.getItem('nbo_admin_password') || 'newbeach2025';
    if (credentials.username === 'admin' && credentials.password === storedPassword) {
      sessionStorage.setItem('nbo_admin_auth', 'true');
      setAuthenticated(true);
      setError('');
    } else {
      setError(t('admin.error'));
    }
  };

  if (!authenticated) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-100 px-5">
        <form onSubmit={login} className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-soft">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-slate-900 text-tealbrand"><Lock size={25} /></div>
          <h1 className="mt-5 text-3xl font-extrabold text-ink">{t('admin.login')}</h1>
          <input value={credentials.username} onChange={(event) => setCredentials({ ...credentials, username: sanitizeInput(event.target.value) })} placeholder={t('admin.username')} className="mt-6 h-12 w-full rounded-full border border-slate-200 px-4 font-semibold outline-none focus:border-tealbrand focus:ring-4 focus:ring-teal-100" />
          <input type="password" value={credentials.password} onChange={(event) => setCredentials({ ...credentials, password: sanitizeInput(event.target.value) })} placeholder={t('admin.password')} className="mt-3 h-12 w-full rounded-full border border-slate-200 px-4 font-semibold outline-none focus:border-tealbrand focus:ring-4 focus:ring-teal-100" />
          {error && <p className="mt-3 text-sm font-bold text-rose-600">{error}</p>}
          <button className="mt-6 w-full rounded-full bg-skybrand px-5 py-3 font-extrabold text-white hover:bg-sky-600">{t('admin.signIn')}</button>
        </form>
      </div>
    );
  }

  const exportCsv = () => {
    const rows = [['Reservation Code', 'Full Name', 'Email', 'Zone', 'Seat Type', 'People', 'Date', 'Total Price', 'Timestamp'], ...bookings.map((booking) => [booking.code, booking.fullName, booking.email, booking.zone.name, booking.seatType, booking.people, booking.date, booking.total, booking.timestamp])];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'new-beach-oran-bookings.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-100 text-ink">
      <aside className={`${menuOpen ? 'fixed inset-y-0 left-0 z-50 flex' : 'hidden'} w-72 flex-col bg-slate-800 p-5 text-white md:fixed md:inset-y-0 md:left-0 md:flex`}>
        <div className="flex items-center justify-between"><div className="flex items-center gap-3"><Waves className="text-tealbrand" /><span className="font-extrabold">New Beach</span></div><button className="md:hidden" onClick={() => setMenuOpen(false)}><X /></button></div>
        <nav className="mt-10 grid gap-2 text-sm font-bold text-slate-300">
          {[
            ['overview', BarChart3, t('admin.overview')],
            ['bookings', FileText, t('admin.bookings')],
            ['zones', Waves, t('admin.zones')],
            ['settings', Settings, t('admin.settings')],
          ].map(([key, Icon, label]) => (
            <button key={key} onClick={() => { setActiveTab(key); setMenuOpen(false); }} className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-left hover:bg-white/10 hover:text-white ${activeTab === key ? 'bg-white/10 text-white' : ''}`}>
              <Icon size={18} />{label}
            </button>
          ))}
        </nav>
        <button onClick={() => { sessionStorage.removeItem('nbo_admin_auth'); onExit(); }} className="mt-auto rounded-full border border-white/15 px-4 py-3 text-sm font-extrabold text-white hover:bg-white/10">{t('admin.logout')}</button>
      </aside>
      <main className="md:pl-72">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/90 px-5 py-4 backdrop-blur md:px-8">
          <button className="md:hidden" onClick={() => setMenuOpen(true)}><Menu /></button>
          <h1 className="text-2xl font-extrabold">{t('admin.dashboard')}</h1>
          <LanguageToggle light />
        </header>
        <div id="admin-overview" className="space-y-8 p-5 md:p-8">
          {adminToast && <div className="fixed right-5 top-5 z-[80] rounded-2xl border border-emerald-200 bg-white px-5 py-4 text-sm font-extrabold text-emerald-700 shadow-soft">{adminToast}</div>}
          {(activeTab === 'overview' || activeTab === 'zones') && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[[t('admin.totalSeats'), state.totalSeats], [t('admin.booked'), seatsBooked], [t('admin.remaining'), remaining], [t('admin.revenue'), formatDA(revenue)]].map(([label, value]) => <article key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-extrabold text-muted">{label}</p><p className="mt-2 text-3xl font-extrabold text-ink">{value}</p></article>)}</div>}
          {(activeTab === 'overview' || activeTab === 'zones') && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-extrabold">{t('admin.zoneBreakdown')}</h2>
            <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="text-muted"><tr><th className="py-3">Zone</th><th>{t('admin.booked')}</th><th>{t('admin.remaining')}</th><th>{t('admin.revenue')}</th></tr></thead><tbody>{zones.map((zone) => { const zoneBookings = bookings.filter((item) => zoneKey(item.zone.id) === zoneKey(zone.id)); return <tr key={zone.id} className="border-t border-slate-100"><td className="py-3 font-extrabold">{zone.name}</td><td>{zoneBookings.reduce((sum, item) => sum + item.people, 0)}</td><td>{zone.remaining}</td><td>{formatDA(zoneBookings.reduce((sum, item) => sum + item.total, 0))}</td></tr>; })}</tbody></table></div>
          </section>}
          {(activeTab === 'overview' || activeTab === 'bookings') && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center"><h2 className="text-xl font-extrabold">{t('admin.bookingsTable')}</h2><button onClick={exportCsv} className="inline-flex items-center justify-center gap-2 rounded-full border border-tealbrand px-4 py-2 text-sm font-extrabold text-tealbrand hover:bg-teal-50"><Download size={16} />{t('admin.export')}</button></div>
            <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_190px_190px]"><label className="relative"><Search className="absolute left-4 top-3.5 text-muted" size={17} /><input value={query} onChange={(event) => setQuery(sanitizeInput(event.target.value))} placeholder={t('admin.search')} className="h-12 w-full rounded-full border border-slate-200 pl-11 pr-4 font-semibold outline-none focus:border-tealbrand focus:ring-4 focus:ring-teal-100" /></label><select value={zoneFilter} onChange={(event) => setZoneFilter(event.target.value)} className="h-12 rounded-full border border-slate-200 px-4 font-semibold outline-none"><option value="">{t('admin.filterZone')}</option>{zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name}</option>)}</select><input type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} className="h-12 rounded-full border border-slate-200 px-4 font-semibold outline-none" /></div>
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[1200px] text-left text-sm">
                <thead className="text-muted">
                  <tr>
                    {['Code', t('booking.fullName'), t('booking.email'), 'Zone', t('booking.type'), t('booking.people'), t('booking.date'), t('booking.total'), t('admin.status'), t('admin.timestamp'), ''].map((head) => (
                      <th key={head} className="py-3 pr-4">{head}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((booking) => {
                    const isPaid = booking.paid ?? false;
                    return (
                      <tr key={booking.code} className="border-t border-slate-100">
                        <td className="py-3 pr-4 font-extrabold">{booking.code}</td>
                        <td className="pr-4">{booking.fullName}</td>
                        <td className="pr-4">{booking.email}</td>
                        <td className="pr-4">{booking.zone.name}</td>
                        <td className="pr-4">{booking.seatType}</td>
                        <td className="pr-4">{booking.people}</td>
                        <td className="pr-4">{booking.date}</td>
                        <td className="pr-4 font-extrabold">{formatDA(booking.total)}</td>
                        <td className="pr-4">
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-extrabold ${isPaid ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                            {isPaid ? t('admin.paid') : t('admin.unpaid')}
                          </span>
                        </td>
                        <td className="pr-4">{new Date(booking.timestamp).toLocaleString()}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            {isPaid ? (
                              <button disabled className="inline-flex cursor-not-allowed items-center gap-1 rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-extrabold text-white">
                                <Check size={14} /> {t('admin.paid')}
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  markAsPaid(booking.code);
                                  showAdminToast(`${t('admin.paymentConfirmed')} ${booking.code}`);
                                }}
                                className="inline-flex items-center gap-1 rounded-full border border-emerald-400 bg-white px-3 py-1.5 text-xs font-extrabold text-emerald-600 hover:bg-emerald-50 disabled:cursor-not-allowed"
                              >
                                <Check size={14} /> {t('admin.verify')}
                              </button>
                            )}
                            <button onClick={() => window.confirm(t('admin.confirmDelete')) && onCancelBooking(booking.code)} className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-3 py-1.5 text-xs font-extrabold text-rose-700">
                              <Trash2 size={14} />{t('admin.delete')}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan="11" className="py-8 text-center font-bold text-muted">{t('admin.noBookings')}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>}
          {activeTab === 'settings' && <AdminSettings t={t} />}
        </div>
      </main>
    </div>
  );
}

function getStatus(zone, t) {
  const ratio = zone.remaining / zone.capacity;
  if (zone.remaining === 0) return { label: t('availability.full'), className: 'bg-rose-100 text-rose-700' };
  if (ratio <= 0.25) return { label: t('availability.filling'), className: 'bg-amber-100 text-amber-700' };
  return { label: t('availability.available'), className: 'bg-emerald-100 text-emerald-700' };
}

createRoot(document.getElementById('root')).render(<Root />);

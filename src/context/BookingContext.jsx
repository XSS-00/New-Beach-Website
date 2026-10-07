import React, { createContext, useContext, useEffect, useMemo, useReducer } from 'react';

const TOTAL_SEATS = 200;
const ZONE_TOTALS = {
  bango: 70,
  danzo: 60,
  costaFiesta: 70,
};

const DEFAULT_ZONE_PRICES = {
  bango: { normal: 2000 },
  danzo: { normal: 3000 },
  costa: { normal: 4000, vip: 5000 },
};

const zoneIdMap = {
  bango: 'bango',
  danzo: 'danzo',
  costa: 'costaFiesta',
  costaFiesta: 'costaFiesta',
};

const BookingContext = createContext(null);

function zoneKey(zoneId) {
  return zoneIdMap[zoneId] ?? zoneId;
}

function normalizeBooking(booking) {
  const people = Number(booking.people ?? booking.numberOfPeople ?? 0);
  return {
    ...booking,
    people,
    numberOfPeople: people,
    paid: booking.paid ?? false,
    date: normalizeDateString(booking.date),
    zone: booking.zone ?? { id: booking.zoneId, name: booking.zoneName },
  };
}

function normalizeDateString(value) {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return toDateString(date);
}

function buildSeatsPerZone(bookings) {
  const seatsPerZone = {
    bango: { total: ZONE_TOTALS.bango, booked: 0 },
    danzo: { total: ZONE_TOTALS.danzo, booked: 0 },
    costaFiesta: { total: ZONE_TOTALS.costaFiesta, booked: 0 },
  };

  bookings.forEach((booking) => {
    const key = zoneKey(booking.zone?.id ?? booking.zoneId);
    if (seatsPerZone[key]) seatsPerZone[key].booked += booking.people;
  });

  return seatsPerZone;
}

function buildState(bookings) {
  return buildStateWithPrices(bookings, loadZonePrices());
}

function buildStateWithPrices(bookings, zonePrices) {
  const normalized = bookings.map(normalizeBooking).filter((booking) => booking.code && booking.people > 0);
  return {
    bookings: normalized,
    totalSeats: TOTAL_SEATS,
    seatsPerZone: buildSeatsPerZone(normalized),
    zonePrices,
  };
}

function loadInitialState() {
  try {
    const zonePrices = loadZonePrices();
    const raw = localStorage.getItem('nbo_bookings');
    if (!raw) return buildStateWithPrices([], zonePrices);
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return buildStateWithPrices(parsed, zonePrices);
    if (Array.isArray(parsed.bookings)) return buildStateWithPrices(parsed.bookings, zonePrices);
    return buildStateWithPrices([], zonePrices);
  } catch {
    return buildState([]);
  }
}

function loadZonePrices() {
  try {
    const raw = localStorage.getItem('nbo_zone_prices');
    if (!raw) return DEFAULT_ZONE_PRICES;
    const parsed = JSON.parse(raw);
    return {
      bango: { normal: Number(parsed.bango?.normal) || DEFAULT_ZONE_PRICES.bango.normal },
      danzo: { normal: Number(parsed.danzo?.normal) || DEFAULT_ZONE_PRICES.danzo.normal },
      costa: {
        normal: Number(parsed.costa?.normal) || DEFAULT_ZONE_PRICES.costa.normal,
        vip: Number(parsed.costa?.vip) || DEFAULT_ZONE_PRICES.costa.vip,
      },
    };
  } catch {
    return DEFAULT_ZONE_PRICES;
  }
}

function reducer(state, action) {
  if (action.type === 'ADD_BOOKING') {
    const booking = normalizeBooking(action.booking);
    return buildStateWithPrices([booking, ...state.bookings.filter((item) => item.code !== booking.code)], state.zonePrices);
  }
  if (action.type === 'CANCEL_BOOKING') {
    return buildStateWithPrices(state.bookings.filter((booking) => booking.code !== action.code), state.zonePrices);
  }
  if (action.type === 'MARK_PAID') {
    return buildStateWithPrices(
      state.bookings.map((booking) =>
        booking.code === action.code
          ? { ...booking, paid: true, paymentMethod: action.paymentMethod ?? booking.paymentMethod }
          : booking,
      ),
      state.zonePrices,
    );
  }
  if (action.type === 'UPDATE_BOOKING') {
    const booking = normalizeBooking(action.booking);
    const exists = state.bookings.some((item) => item.code === booking.code);
    const bookings = exists
      ? state.bookings.map((item) => (item.code === booking.code ? { ...item, ...booking } : item))
      : [booking, ...state.bookings];
    return buildStateWithPrices(bookings, state.zonePrices);
  }
  if (action.type === 'UPDATE_ZONE_PRICE') {
    const current = state.zonePrices[action.zoneId] ?? {};
    return {
      ...state,
      zonePrices: {
        ...state.zonePrices,
        [action.zoneId]: {
          ...current,
          [action.priceType]: Number(action.value) || 0,
        },
      },
    };
  }
  return state;
}

export function BookingProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadInitialState);

  useEffect(() => {
    localStorage.setItem('nbo_bookings', JSON.stringify(state.bookings));
  }, [state.bookings]);

  useEffect(() => {
    localStorage.setItem('nbo_zone_prices', JSON.stringify(state.zonePrices));
  }, [state.zonePrices]);

  const value = useMemo(
    () => ({
      state,
      // NOTE: Browser Notifications only fire on the device/browser where the booking
      // is created. For true cross-device admin alerts (e.g., admin on a phone,
      // visitor booking from home), a backend with push notifications (e.g., Firebase
      // Cloud Messaging) would be required. This client-only implementation covers
      // same-device or same-network kiosk setups.
      addBooking: (booking) => {
        dispatch({ type: 'ADD_BOOKING', booking });
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('New Beach Oran - New Booking', {
            body: `${booking.fullName} booked ${booking.people} seat(s) in ${booking.zone.name} for ${booking.date}.`,
            icon: '/boat-icon.png',
          });
        }
      },
      cancelBooking: (code) => dispatch({ type: 'CANCEL_BOOKING', code }),
      updateBooking: (booking) => dispatch({ type: 'UPDATE_BOOKING', booking }),
      updateZonePrice: (zoneId, priceType, value) => dispatch({ type: 'UPDATE_ZONE_PRICE', zoneId, priceType, value }),
      markAsPaid: (code, paymentMethod) => {
        const lang = localStorage.getItem('nbo_lang') || 'fr';
        dispatch({ type: 'MARK_PAID', code, paymentMethod });
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('🏖️ New Beach Oran', {
            body:
              lang === 'fr'
                ? `Votre réservation ${code} a été confirmée comme PAYÉE. À bientôt à la plage !`
                : `Your reservation ${code} has been confirmed as PAID. See you at the beach!`,
            icon: '/boat-icon.png',
          });
        }
      },
      getZoneBooked: (id) => state.seatsPerZone[zoneKey(id)]?.booked ?? 0,
      getZoneRemaining: (id) => {
        const zone = state.seatsPerZone[zoneKey(id)];
        return zone ? Math.max(0, zone.total - zone.booked) : 0;
      },
    }),
    [state],
  );

  return <BookingContext.Provider value={value}>{children}</BookingContext.Provider>;
}

export function useBooking() {
  const context = useContext(BookingContext);
  if (!context) throw new Error('useBooking must be used inside BookingProvider');
  return context;
}

export function toDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getBookedSeatsForDate(date, bookings) {
  const dateStr = date instanceof Date ? toDateString(date) : normalizeDateString(date);
  return bookings
    .filter((booking) => booking.date === dateStr)
    .reduce((sum, booking) => sum + Number(booking.numberOfPeople ?? booking.people ?? 0), 0);
}

export function isDateFullyBooked(date, bookings, totalSeats = TOTAL_SEATS) {
  return getBookedSeatsForDate(date, bookings) >= totalSeats;
}

export function isPastDate(date) {
  const target = date instanceof Date ? date : new Date(`${date}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return target < today;
}

export { DEFAULT_ZONE_PRICES, TOTAL_SEATS, ZONE_TOTALS, zoneKey };

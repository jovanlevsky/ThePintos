/**
 * TuneUp – Unit Tests
 * Run with: npx jest tuneup.test.js 
 */

// set up
const store = {};
const localStorageMock = {
  getItem:    (k)    => store[k] ?? null,
  setItem:    (k, v) => { store[k] = String(v); },
  removeItem: (k)    => { delete store[k]; },
  clear:      ()     => { Object.keys(store).forEach(k => delete store[k]); },
};
global.localStorage = localStorageMock;
global.window = {
  location: { pathname: '/login.html', href: '' },
};
global.document = {
  querySelectorAll: () => [],
  getElementById:   () => null,
};
global.fetch = jest.fn();

// re-added helper functions here too for readability

function getToken()    { return localStorage.getItem('authToken'); }
function authHeaders() {
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` };
}

function getVehicles()   { return JSON.parse(localStorage.getItem('tuneup_vehicles')  || '[]'); }
function saveVehicles(v) { localStorage.setItem('tuneup_vehicles',  JSON.stringify(v)); }
function getLogs()       { return JSON.parse(localStorage.getItem('tuneup_logs')      || '[]'); }
function saveLogs(l)     { localStorage.setItem('tuneup_logs',      JSON.stringify(l)); }
function getReminders()  { return JSON.parse(localStorage.getItem('tuneup_reminders') || '[]'); }
function saveReminders(r){ localStorage.setItem('tuneup_reminders', JSON.stringify(r)); }
function generateId()    { return '_' + Math.random().toString(36).substr(2, 9); }

function apiVehicleToLocal(v) {
  return {
    id:          String(v.id),
    make:        v.make,
    model:       v.model,
    year:        v.year,
    vin:         v.vin          || '',
    plate:       v.license_plate || '',
    mileage:     v.current_mileage,
    fuelType:    v.fuel_type    || '',
    oilType:     v.oil_type     || '',
    oilInterval: v.oil_change_interval || 5000,
  };
}

function localVehicleToApi(v) {
  return {
    make:                v.make,
    model:               v.model,
    year:                Number(v.year),
    vin:                 v.vin      || null,
    license_plate:       v.plate    || null,
    current_mileage:     Number(v.mileage),
    fuel_type:           v.fuelType || null,
    oil_type:            v.oilType  || null,
    oil_change_interval: Number(v.oilInterval) || null,
  };
}

function apiLogToLocal(l) {
  return {
    id:          String(l.id),
    vehicleId:   String(l.vehicle_id),
    serviceType: l.service_type,
    date:        l.service_date,
    mileage:     l.mileage_at_service,
    notes:       l.notes || '',
  };
}

function localLogToApi(l) {
  return {
    vehicle_id:         l.vehicleId,
    service_type:       l.serviceType,
    service_date:       l.date,
    mileage_at_service: Number(l.mileage),
    notes:              l.notes || null,
  };
}

function apiReminderToLocal(r) {
  return {
    id:             String(r.id),
    vehicleId:      String(r.vehicle_id),
    serviceType:    r.service_type,
    reminderMode:   r.reminder_mode,
    intervalMiles:  r.interval_miles  || 0,
    intervalMonths: r.interval_months || 0,
    lastMileage:    r.last_service_mileage,
    lastDate:       r.last_service_date,
  };
}

function localReminderToApi(r) {
  return {
    vehicle_id:           r.vehicleId,
    service_type:         r.serviceType,
    reminder_mode:        r.reminderMode,
    interval_miles:       Number(r.intervalMiles)  || null,
    interval_months:      Number(r.intervalMonths) || null,
    last_service_mileage: Number(r.lastMileage),
    last_service_date:    r.lastDate,
  };
}

// getVehicleAlerts
function getVehicleAlerts(vehicleId) {
  const vehicle = getVehicles().find(v => v.id === vehicleId);
  if (!vehicle) return [];
  const today = new Date();

  return getReminders().filter(r => r.vehicleId === vehicleId).reduce((alerts, r) => {
    const mode       = r.reminderMode || 'either';
    const usesMiles  = (mode === 'miles'  || mode === 'either') && Number(r.intervalMiles)  > 0;
    const usesMonths = (mode === 'time'   || mode === 'either') && Number(r.intervalMonths) > 0;

    const milesLeft = usesMiles
      ? Number(r.intervalMiles) - (Number(vehicle.mileage) - Number(r.lastMileage))
      : null;

    const lastDate     = new Date(r.lastDate);
    const monthsPassed = (today.getFullYear() - lastDate.getFullYear()) * 12
                       + (today.getMonth() - lastDate.getMonth());
    const monthsLeft = usesMonths ? Number(r.intervalMonths) - monthsPassed : null;

    let overdue = false, dueSoon = false;
    if (mode === 'miles') {
      overdue = usesMiles && milesLeft <= 0;
      dueSoon = !overdue && usesMiles && milesLeft <= 5000;
    } else if (mode === 'time') {
      overdue = usesMonths && monthsLeft <= 0;
      dueSoon = !overdue && usesMonths && monthsLeft <= 6;
    } else {
      overdue = (usesMiles && milesLeft <= 0) || (usesMonths && monthsLeft <= 0);
      dueSoon = !overdue && ((usesMiles && milesLeft <= 5000) || (usesMonths && monthsLeft <= 6));
    }

    if (overdue)       alerts.push({ type: 'overdue', service: r.serviceType, milesLeft, monthsLeft });
    else if (dueSoon)  alerts.push({ type: 'soon',    service: r.serviceType, milesLeft, monthsLeft });
    return alerts;
  }, []);
}

// getInitials
function getInitials(name) {
  if (!name) return '?';
  return name.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

// tests --------------------------------------------------------------------------------------------------------------------------

beforeEach(() => {
  localStorageMock.clear();
  jest.clearAllMocks();
});

// localStorage tests
describe('localStorage helpers', () => {
  test('getVehicles returns [] when nothing stored', () => {
    expect(getVehicles()).toEqual([]);
  });

  test('saveVehicles / getVehicles round-trips correctly', () => {
    const v = [{ id: '1', make: 'Honda', model: 'Civic', year: 2020 }];
    saveVehicles(v);
    expect(getVehicles()).toEqual(v);
  });

  test('getLogs returns [] when nothing stored', () => {
    expect(getLogs()).toEqual([]);
  });

  test('saveLogs / getLogs round-trips correctly', () => {
    const l = [{ id: '1', vehicleId: '1', serviceType: 'Oil Change', date: '2024-01-01', mileage: 10000 }];
    saveLogs(l);
    expect(getLogs()).toEqual(l);
  });

  test('getReminders returns [] when nothing stored', () => {
    expect(getReminders()).toEqual([]);
  });

  test('saveReminders / getReminders round-trips correctly', () => {
    const r = [{ id: '1', vehicleId: '1', serviceType: 'Oil Change' }];
    saveReminders(r);
    expect(getReminders()).toEqual(r);
  });
});

// id tests
describe('generateId', () => {
  test('starts with underscore', () => {
    expect(generateId()).toMatch(/^_/);
  });

  test('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, generateId));
    expect(ids.size).toBe(100);
  });
});

// token tests
describe('authHeaders', () => {
  test('returns correct Content-Type', () => {
    expect(authHeaders()['Content-Type']).toBe('application/json');
  });

  test('includes Bearer token when set', () => {
    localStorage.setItem('authToken', 'abc123');
    expect(authHeaders().Authorization).toBe('Bearer abc123');
  });

  test('includes "Bearer null" when no token stored', () => {
    expect(authHeaders().Authorization).toBe('Bearer null');
  });
});

// api vehicle sent to local
describe('apiVehicleToLocal', () => {
  const apiVehicle = {
    id: 42, make: 'Toyota', model: 'Camry', year: 2022,
    vin: '1HGCM82633A123456', license_plate: 'ABC-123',
    current_mileage: 30000, fuel_type: 'Gasoline',
    oil_type: '0W-20', oil_change_interval: 5000,
  };

  test('converts id to string', () => {
    expect(apiVehicleToLocal(apiVehicle).id).toBe('42');
  });

  test('maps license_plate → plate', () => {
    expect(apiVehicleToLocal(apiVehicle).plate).toBe('ABC-123');
  });

  test('maps current_mileage → mileage', () => {
    expect(apiVehicleToLocal(apiVehicle).mileage).toBe(30000);
  });

  test('maps fuel_type → fuelType', () => {
    expect(apiVehicleToLocal(apiVehicle).fuelType).toBe('Gasoline');
  });

  test('defaults oilInterval to 5000 when null', () => {
    expect(apiVehicleToLocal({ ...apiVehicle, oil_change_interval: null }).oilInterval).toBe(5000);
  });

  test('defaults vin to empty string when null', () => {
    expect(apiVehicleToLocal({ ...apiVehicle, vin: null }).vin).toBe('');
  });

  test('defaults plate to empty string when null', () => {
    expect(apiVehicleToLocal({ ...apiVehicle, license_plate: null }).plate).toBe('');
  });
});

// local vehicle being sent to api
describe('localVehicleToApi', () => {
  const localVehicle = {
    make: 'Ford', model: 'F-150', year: '2019',
    vin: '', plate: '', mileage: '75000',
    fuelType: 'Gasoline', oilType: '5W-30', oilInterval: '7500',
  };

  test('converts year to number', () => {
    expect(localVehicleToApi(localVehicle).year).toBe(2019);
  });

  test('converts mileage to number', () => {
    expect(localVehicleToApi(localVehicle).current_mileage).toBe(75000);
  });

  test('maps empty vin to null', () => {
    expect(localVehicleToApi(localVehicle).vin).toBeNull();
  });

  test('maps empty plate to null', () => {
    expect(localVehicleToApi(localVehicle).license_plate).toBeNull();
  });

  test('maps oilInterval to oil_change_interval as number', () => {
    expect(localVehicleToApi(localVehicle).oil_change_interval).toBe(7500);
  });

  test('maps fuelType → fuel_type', () => {
    expect(localVehicleToApi(localVehicle).fuel_type).toBe('Gasoline');
  });
});

// api log sent to local
describe('apiLogToLocal', () => {
  const apiLog = {
    id: 7, vehicle_id: 3, service_type: 'Tire Rotation',
    service_date: '2024-03-15', mileage_at_service: 22000, notes: null,
  };

  test('converts id to string', () => {
    expect(apiLogToLocal(apiLog).id).toBe('7');
  });

  test('maps vehicle_id → vehicleId as string', () => {
    expect(apiLogToLocal(apiLog).vehicleId).toBe('3');
  });

  test('maps service_type → serviceType', () => {
    expect(apiLogToLocal(apiLog).serviceType).toBe('Tire Rotation');
  });

  test('maps service_date → date', () => {
    expect(apiLogToLocal(apiLog).date).toBe('2024-03-15');
  });

  test('maps mileage_at_service → mileage', () => {
    expect(apiLogToLocal(apiLog).mileage).toBe(22000);
  });

  test('defaults notes to empty string when null', () => {
    expect(apiLogToLocal(apiLog).notes).toBe('');
  });
});

// local log sent to api
describe('localLogToApi', () => {
  const localLog = {
    vehicleId: '3', serviceType: 'Brake Inspection',
    date: '2024-06-01', mileage: '45000', notes: '',
  };

  test('maps vehicleId → vehicle_id', () => {
    expect(localLogToApi(localLog).vehicle_id).toBe('3');
  });

  test('maps serviceType → service_type', () => {
    expect(localLogToApi(localLog).service_type).toBe('Brake Inspection');
  });

  test('converts mileage to number', () => {
    expect(localLogToApi(localLog).mileage_at_service).toBe(45000);
  });

  test('maps empty notes to null', () => {
    expect(localLogToApi(localLog).notes).toBeNull();
  });
});

// api reminders going to local
describe('apiReminderToLocal', () => {
  const apiReminder = {
    id: 5, vehicle_id: 2, service_type: 'Oil Change',
    reminder_mode: 'either', interval_miles: 5000, interval_months: 6,
    last_service_mileage: 40000, last_service_date: '2024-01-01',
  };

  test('converts id to string', () => {
    expect(apiReminderToLocal(apiReminder).id).toBe('5');
  });

  test('maps vehicle_id → vehicleId as string', () => {
    expect(apiReminderToLocal(apiReminder).vehicleId).toBe('2');
  });

  test('maps reminder_mode → reminderMode', () => {
    expect(apiReminderToLocal(apiReminder).reminderMode).toBe('either');
  });

  test('maps interval_miles → intervalMiles', () => {
    expect(apiReminderToLocal(apiReminder).intervalMiles).toBe(5000);
  });

  test('defaults intervalMiles to 0 when null', () => {
    expect(apiReminderToLocal({ ...apiReminder, interval_miles: null }).intervalMiles).toBe(0);
  });

  test('defaults intervalMonths to 0 when null', () => {
    expect(apiReminderToLocal({ ...apiReminder, interval_months: null }).intervalMonths).toBe(0);
  });
});

// local reminders sent to api
describe('localReminderToApi', () => {
  const localReminder = {
    vehicleId: '2', serviceType: 'Oil Change', reminderMode: 'miles',
    intervalMiles: 5000, intervalMonths: 0,
    lastMileage: '40000', lastDate: '2024-01-01',
  };

  test('maps vehicleId → vehicle_id', () => {
    expect(localReminderToApi(localReminder).vehicle_id).toBe('2');
  });

  test('maps reminderMode → reminder_mode', () => {
    expect(localReminderToApi(localReminder).reminder_mode).toBe('miles');
  });

  test('maps intervalMiles to number', () => {
    expect(localReminderToApi(localReminder).interval_miles).toBe(5000);
  });

  test('converts 0 intervalMonths to null', () => {
    expect(localReminderToApi(localReminder).interval_months).toBeNull();
  });

  test('converts lastMileage string to number', () => {
    expect(localReminderToApi(localReminder).last_service_mileage).toBe(40000);
  });
});

// getvehiclealerts
describe('getVehicleAlerts', () => {
  const VEHICLE_ID = 'v1';

  function setupVehicle(mileage) {
    saveVehicles([{ id: VEHICLE_ID, make: 'Honda', model: 'Civic', year: 2020, mileage }]);
  }

  function pastDate(monthsAgo) {
    const d = new Date();
    d.setMonth(d.getMonth() - monthsAgo);
    return d.toISOString().slice(0, 10);
  }

  test('returns [] for unknown vehicle', () => {
    expect(getVehicleAlerts('nonexistent')).toEqual([]);
  });

  test('returns [] when no reminders exist', () => {
    setupVehicle(50000);
    saveReminders([]);
    expect(getVehicleAlerts(VEHICLE_ID)).toEqual([]);
  });

  test('flags overdue when mileage exceeded (miles mode)', () => {
    setupVehicle(50000);  // current mileage
    saveReminders([{
      id: 'r1', vehicleId: VEHICLE_ID, serviceType: 'Oil Change',
      reminderMode: 'miles', intervalMiles: 5000, intervalMonths: 0,
      lastMileage: 40000,    // 10 000 miles ago → 5 000 over interval
      lastDate: pastDate(1),
    }]);
    const alerts = getVehicleAlerts(VEHICLE_ID);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].type).toBe('overdue');
    expect(alerts[0].service).toBe('Oil Change');
  });

  test('flags due soon when within 5000 miles (miles mode)', () => {
    setupVehicle(44000);  // 4 000 miles since last service
    saveReminders([{
      id: 'r1', vehicleId: VEHICLE_ID, serviceType: 'Tire Rotation',
      reminderMode: 'miles', intervalMiles: 5000, intervalMonths: 0,
      lastMileage: 40000, lastDate: pastDate(1),
    }]);
    const alerts = getVehicleAlerts(VEHICLE_ID);
    expect(alerts[0].type).toBe('soon');
  });

  test('flags overdue when time exceeded (time mode)', () => {
    setupVehicle(50000);
    saveReminders([{
      id: 'r1', vehicleId: VEHICLE_ID, serviceType: 'State Inspection',
      reminderMode: 'time', intervalMiles: 0, intervalMonths: 12,
      lastMileage: 40000, lastDate: pastDate(14), // 14 months ago
    }]);
    const alerts = getVehicleAlerts(VEHICLE_ID);
    expect(alerts[0].type).toBe('overdue');
  });

  test('flags due soon when within 6 months (time mode)', () => {
    setupVehicle(50000);
    saveReminders([{
      id: 'r1', vehicleId: VEHICLE_ID, serviceType: 'State Inspection',
      reminderMode: 'time', intervalMiles: 0, intervalMonths: 12,
      lastMileage: 40000, lastDate: pastDate(9), // 9 months ago → 3 months left
    }]);
    const alerts = getVehicleAlerts(VEHICLE_ID);
    expect(alerts[0].type).toBe('soon');
  });

  test('either mode: overdue if either threshold exceeded', () => {
    setupVehicle(50000);  // mileage fine, but time overdue
    saveReminders([{
      id: 'r1', vehicleId: VEHICLE_ID, serviceType: 'Oil Change',
      reminderMode: 'either', intervalMiles: 5000, intervalMonths: 6,
      lastMileage: 48000,     // only 2000 miles ago (fine)
      lastDate: pastDate(8),  // 8 months ago (overdue on time)
    }]);
    const alerts = getVehicleAlerts(VEHICLE_ID);
    expect(alerts[0].type).toBe('overdue');
  });
});

// initials rendering tests
describe('getInitials', () => {
  test('returns ? for falsy input', () => {
    expect(getInitials('')).toBe('?');
    expect(getInitials(null)).toBe('?');
    expect(getInitials(undefined)).toBe('?');
  });

  test('single name returns one uppercase letter', () => {
    expect(getInitials('Alice')).toBe('A');
  });

  test('first and last name returns two uppercase letters', () => {
    expect(getInitials('John Doe')).toBe('JD');
  });

  test('three-word name still returns only two initials', () => {
    expect(getInitials('Mary Jane Watson')).toBe('MJ');
  });

  test('handles extra whitespace gracefully', () => {
    expect(getInitials('  Jane  Smith  ')).toBe('JS');
  });

  test('lowercased input is uppercased', () => {
    expect(getInitials('alice bob')).toBe('AB');
  });
});

import { CalendarEvent, PackageComponent, Payment, Service } from './types';

export function isPackageService(service: Pick<Service, 'packageItems'>): boolean {
  return Array.isArray(service.packageItems) && service.packageItems.length > 0;
}

export function getPackageComponentsValue(
  components: PackageComponent[],
  services: Service[] | null | undefined
): number {
  return components.reduce((sum, component) => {
    const service = services?.find(s => s.id === component.serviceId);
    if (!service) return sum;
    const unitPrice = Math.max(0, service.price - (service.discount || 0));
    return sum + unitPrice * component.quantity;
  }, 0);
}

export interface PackageEntitlement {
  serviceId: string;
  serviceName: string;
  purchased: number;
  used: number; // covered events with start <= now
  booked: number; // covered events in the future
  remaining: number; // purchased - used - booked
}

export interface StudentPackageData {
  entitlements: PackageEntitlement[];
  coveredEventIds: Set<string>;
  hasUnpaidPackagePayment: boolean;
}

const EMPTY_PACKAGE_DATA: StudentPackageData = {
  entitlements: [],
  coveredEventIds: new Set<string>(),
  hasUnpaidPackagePayment: false,
};

// Entitlements are derived on the fly (like advance credit in payment-utils):
// purchases come from Payment items that carry a packageItems snapshot, and
// consumption is allocated to the student's lessons chronologically. Nothing
// is written back to events, so cancelling a lesson or paying a bill
// separately returns units automatically.
export function getStudentPackageData(
  payments: Payment[] | null | undefined,
  events: CalendarEvent[] | null | undefined,
  studentId: string | null | undefined,
  now: number = Date.now()
): StudentPackageData {
  if (!studentId) return EMPTY_PACKAGE_DATA;

  const purchased = new Map<string, { name: string; quantity: number }>();
  let hasUnpaidPackagePayment = false;

  for (const payment of payments || []) {
    if (payment.studentId !== studentId) continue;
    for (const item of payment.items || []) {
      if (!item.packageItems?.length) continue;
      // Unpaid package bills still grant units so installment buyers can
      // start lessons; the UI shows a balance-due hint instead.
      if (payment.status === 'unpaid') hasUnpaidPackagePayment = true;
      for (const component of item.packageItems) {
        const entry = purchased.get(component.serviceId) || { name: component.name, quantity: 0 };
        entry.quantity += component.quantity * (item.quantity || 1);
        entry.name = component.name;
        purchased.set(component.serviceId, entry);
      }
    }
  }

  if (purchased.size === 0) return EMPTY_PACKAGE_DATA;

  const findKey = (service: { id: string; name: string }) => {
    if (purchased.has(service.id)) return service.id;
    for (const [key, value] of purchased) {
      if (value.name === service.name) return key;
    }
    return null;
  };

  const candidates = (events || [])
    .filter(event => event.studentId === studentId)
    .filter(event => {
      const lessonStatus = event.lessonStatus ?? 'scheduled';
      return lessonStatus !== 'cancelled' && lessonStatus !== 'no-show';
    })
    .filter(event => event.paymentStatus !== 'paid')
    .filter(event => (event.services?.length || 0) > 0)
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  const remaining = new Map<string, number>();
  for (const [key, value] of purchased) remaining.set(key, value.quantity);
  const used = new Map<string, number>();
  const booked = new Map<string, number>();
  const coveredEventIds = new Set<string>();

  for (const event of candidates) {
    const needs = new Map<string, number>();
    let coverable = true;
    for (const service of event.services) {
      const key = findKey(service);
      if (!key) {
        coverable = false;
        break;
      }
      needs.set(key, (needs.get(key) || 0) + 1);
    }
    if (!coverable) continue;
    for (const [key, count] of needs) {
      if ((remaining.get(key) || 0) < count) {
        coverable = false;
        break;
      }
    }
    if (!coverable) continue;

    const tally = new Date(event.start).getTime() <= now ? used : booked;
    for (const [key, count] of needs) {
      remaining.set(key, (remaining.get(key) || 0) - count);
      tally.set(key, (tally.get(key) || 0) + count);
    }
    coveredEventIds.add(event.id);
  }

  const entitlements: PackageEntitlement[] = Array.from(purchased, ([serviceId, value]) => ({
    serviceId,
    serviceName: value.name,
    purchased: value.quantity,
    used: used.get(serviceId) || 0,
    booked: booked.get(serviceId) || 0,
    remaining: remaining.get(serviceId) || 0,
  }));

  return { entitlements, coveredEventIds, hasUnpaidPackagePayment };
}

export function formatPackageContents(components: PackageComponent[]): string {
  return components.map(component => `${component.quantity}× ${component.name}`).join(', ');
}

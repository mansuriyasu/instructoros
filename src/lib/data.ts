import { Student, Service, Payment } from './types';
import { PlaceHolderImages } from './placeholder-images';

function getRandomAvatar() {
  const randomIndex = Math.floor(Math.random() * PlaceHolderImages.length);
  return PlaceHolderImages[randomIndex].imageUrl;
}

export const MOCK_STUDENTS: Student[] = [
  { id: '1', name: 'Alice Johnson', mobileNumber: '', address: '123 Main St', birthdate: '20000101', licenseNumber: 'J1234-56789-12345', licenseExpiry: '20251020', licenseType: 'G2', status: 'active', comments: 'Needs practice with parallel parking.', avatarUrl: getRandomAvatar(), registrationDate: '2023-01-15T10:30:00Z' },
  { id: '2', name: 'Bob Smith', mobileNumber: '', address: '456 Oak Ave', birthdate: '19990515', licenseNumber: 'S2345-67890-23456', licenseExpiry: '20241215', licenseType: 'G', status: 'booked', comments: 'Very confident driver.', avatarUrl: getRandomAvatar(), registrationDate: '2023-02-20T11:00:00Z' },
  { id: '3', name: 'Charlie Brown', mobileNumber: '', address: '789 Pine Rd', birthdate: '20021130', licenseNumber: 'B3456-78901-34567', licenseExpiry: '20260530', licenseType: 'G2', status: 'on-hold', comments: 'Paused lessons for exams.', avatarUrl: getRandomAvatar(), registrationDate: '2023-03-10T14:00:00Z' },
  { id: '4', name: 'Diana Prince', mobileNumber: '', address: '101 Elm St', birthdate: '19980808', licenseNumber: 'P4567-89012-45678', licenseExpiry: '20240801', licenseType: 'G', status: 'active', comments: 'Excels at highway driving.', avatarUrl: getRandomAvatar(), registrationDate: '2023-04-05T09:00:00Z' },
  { id: '5', name: 'Ethan Hunt', mobileNumber: '', address: '202 Maple Dr', birthdate: '20010325', licenseNumber: 'H5678-90123-56789', licenseExpiry: '20270110', licenseType: 'G2', status: 'deactivated', comments: 'Moved to another city.', avatarUrl: getRandomAvatar(), registrationDate: '2023-05-12T13:45:00Z' },
  { id: '6', name: 'Fiona Glenanne', mobileNumber: '', address: '303 Birch Ln', birthdate: '19951212', licenseNumber: 'G6789-01234-67890', licenseExpiry: '20251111', licenseType: 'G', status: 'active', comments: 'Working on smooth braking.', avatarUrl: getRandomAvatar(), registrationDate: '2023-06-18T16:20:00Z' },
  { id: '7', name: 'George Costanza', mobileNumber: '', address: '404 Cedar Ct', birthdate: '19970707', licenseNumber: 'C7890-12345-78901', licenseExpiry: '20240922', licenseType: 'G2', status: 'booked', comments: 'Nervous in heavy traffic.', avatarUrl: getRandomAvatar(), registrationDate: '2023-07-22T08:15:00Z' },
  { id: '8', name: 'Hannah Montana', mobileNumber: '', address: '505 Spruce Way', birthdate: '20030404', licenseNumber: 'M8901-23456-89012', licenseExpiry: '20260318', licenseType: 'G', status: 'active', comments: '', avatarUrl: getRandomAvatar(), registrationDate: '2023-08-30T17:00:00Z' },
];

export const MOCK_SERVICES: Service[] = [
  { id: '1', name: 'Single Lesson', price: 60, order: 1 },
  { id: '2', name: '5-Lesson Package', price: 280, discount: 20, order: 2 },
  { id: '3', name: '10-Lesson Package', price: 550, discount: 50, order: 3 },
  { id: '4', name: 'Road Test (G2)', price: 150, order: 4 },
  { id: '5', name: 'Road Test (G)', price: 180, order: 5 },
  { id: '6', name: 'Car Rental for Test', price: 100, order: 6 },
  { id: '7', name: 'Highway Driving', price: 90, order: 7 },
  { id: '8', name: 'Defensive Driving Course', price: 250, order: 8 },
];

export const MOCK_PAYMENTS: Payment[] = [
  { id: '1', studentId: '1', studentName: 'Alice Johnson', items: [{ id: '2', billItemId: 'b1', name: '5-Lesson Package', price: 280, quantity: 1, date: '2023-06-01' }], total: 280, subtotal: 280, discount: 0, tax: 0, totalCost: 280, paidAmount: 280, amountDue: 0, paymentMethod: 'E-Transfer', paymentDate: '2023-06-01T10:00:00Z', status: 'paid' },
  { id: '2', studentId: '2', studentName: 'Bob Smith', items: [{ id: '4', billItemId: 'b2', name: 'Road Test (G2)', price: 150, quantity: 1, date: '2023-06-05' }], total: 150, subtotal: 150, discount: 0, tax: 0, totalCost: 150, paidAmount: 150, amountDue: 0, paymentMethod: 'Cash', paymentDate: '2023-06-05T14:30:00Z', status: 'paid' },
  { id: '3', studentId: '4', studentName: 'Diana Prince', items: [{ id: '1', billItemId: 'b3', name: 'Single Lesson', price: 60, quantity: 1, date: '2023-06-10' }], total: 60, subtotal: 60, discount: 0, tax: 0, totalCost: 60, paidAmount: 0, amountDue: 60, paymentMethod: 'Unpaid', paymentDate: '2023-06-10T09:45:00Z', status: 'unpaid' },
  { id: '4', studentId: null, studentName: 'Walk-in Customer', items: [{ id: '1', billItemId: 'b4', name: 'Single Lesson', price: 60, quantity: 1, date: '2023-06-12' }], total: 60, subtotal: 60, discount: 0, tax: 0, totalCost: 60, paidAmount: 60, amountDue: 0, paymentMethod: 'Cash', paymentDate: '2023-06-12T11:00:00Z', status: 'paid' },
  { id: '5', studentId: '6', studentName: 'Fiona Glenanne', items: [{ id: '3', billItemId: 'b5', name: '10-Lesson Package', price: 550, quantity: 1, date: '2023-06-15' }], total: 550, subtotal: 550, discount: 0, tax: 0, totalCost: 550, paidAmount: 550, amountDue: 0, paymentMethod: 'E-Transfer', paymentDate: '2023-06-15T18:00:00Z', status: 'paid' },
  { id: '6', studentId: '7', studentName: 'George Costanza', items: [{ id: '1', billItemId: 'b6', name: 'Single Lesson', price: 60, quantity: 1, date: '2023-06-20' }, { id: '1', billItemId: 'b7', name: 'Single Lesson', price: 60, quantity: 1, date: '2023-06-20' }], total: 120, subtotal: 120, discount: 0, tax: 0, totalCost: 120, paidAmount: 0, amountDue: 120, paymentMethod: 'Unpaid', paymentDate: '2023-06-20T13:00:00Z', status: 'unpaid' },
  { id: '7', studentId: '1', studentName: 'Alice Johnson', items: [{ id: '4', billItemId: 'b8', name: 'Road Test (G2)', price: 150, quantity: 1, date: '2023-07-02' }], total: 150, subtotal: 150, discount: 0, tax: 0, totalCost: 150, paidAmount: 150, amountDue: 0, paymentMethod: 'Cash', paymentDate: '2023-07-02T16:00:00Z', status: 'paid' },
];

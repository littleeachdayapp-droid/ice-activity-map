import { Report } from '../types/report';

const now = new Date();
const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 60 * 60 * 1000);

export const mockReports: Report[] = [
  {
    id: '1',
    activityType: 'raid',
    location: {
      lat: 34.0522,
      lng: -118.2437,
      city: 'Los Angeles',
      state: 'CA'
    },
    description: 'ICE agents seen at apartment complex on Main Street. Multiple vehicles present. Residents advised to know their rights.',
    timestamp: hoursAgo(2),
    author: 'Community Watch LA',
    status: 'verified'
  },
  {
    id: '2',
    activityType: 'checkpoint',
    location: {
      lat: 32.7157,
      lng: -117.1611,
      city: 'San Diego',
      state: 'CA'
    },
    description: 'Immigration checkpoint reported on I-5 near San Ysidro. All vehicles being stopped and checked.',
    timestamp: hoursAgo(6),
    author: 'Border Watch',
    status: 'verified'
  },
  {
    id: '3',
    activityType: 'arrest',
    location: {
      lat: 29.7604,
      lng: -95.3698,
      city: 'Houston',
      state: 'TX'
    },
    description: 'Reports of arrest outside courthouse. Individual was taken into custody after appearing for unrelated hearing.',
    timestamp: hoursAgo(12),
    author: 'Houston Immigrant Rights',
    status: 'unverified'
  },
  {
    id: '4',
    activityType: 'surveillance',
    location: {
      lat: 33.749,
      lng: -84.388,
      city: 'Atlanta',
      state: 'GA'
    },
    description: 'Unmarked vehicles observed near day labor site for several hours. No direct contact made with workers.',
    timestamp: hoursAgo(24),
    author: 'Atlanta Workers Coalition',
    status: 'unverified'
  },
  {
    id: '5',
    activityType: 'raid',
    location: {
      lat: 41.8781,
      lng: -87.6298,
      city: 'Chicago',
      state: 'IL'
    },
    description: 'Workplace enforcement action at meatpacking facility. Multiple workers detained. Legal observers on scene.',
    timestamp: hoursAgo(48),
    author: 'Chicago Legal Aid',
    status: 'verified'
  },
  {
    id: '6',
    activityType: 'checkpoint',
    location: {
      lat: 31.7619,
      lng: -106.485,
      city: 'El Paso',
      state: 'TX'
    },
    description: 'Mobile checkpoint set up on Highway 54. Agents checking documents of all passengers.',
    timestamp: hoursAgo(72),
    author: 'El Paso Network',
    status: 'verified'
  },
  {
    id: '7',
    activityType: 'other',
    location: {
      lat: 40.7128,
      lng: -74.006,
      city: 'New York',
      state: 'NY'
    },
    description: 'ICE officers seen in plainclothes near transit hub. Appeared to be monitoring the area but no enforcement action observed.',
    timestamp: hoursAgo(120),
    author: 'NYC Rapid Response',
    status: 'disputed'
  },
  {
    id: '8',
    activityType: 'arrest',
    location: {
      lat: 33.4484,
      lng: -112.074,
      city: 'Phoenix',
      state: 'AZ'
    },
    description: 'Individual detained during traffic stop. Passenger in vehicle was taken into ICE custody.',
    timestamp: hoursAgo(168),
    author: 'AZ Immigrant Advocates',
    status: 'verified'
  }
];

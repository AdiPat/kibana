/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { Locations, LocationStatus, PrivateLocation } from '../../../../common/runtime_types';
import { normalizeProjectMonitors } from '.';

describe('icmp normalizers', () => {
  describe('normalize push monitors', () => {
    const projectId = 'test-project-id';
    const locations: Locations = [
      {
        id: 'us_central',
        label: 'Test Location',
        geo: { lat: 33.333, lon: 73.333 },
        url: 'test-url',
        isServiceManaged: true,
        status: LocationStatus.GA,
      },
      {
        id: 'us_east',
        label: 'Test Location',
        geo: { lat: 33.333, lon: 73.333 },
        url: 'test-url',
        isServiceManaged: true,
        status: LocationStatus.GA,
      },
    ];
    const privateLocations: PrivateLocation[] = [
      {
        id: 'germany',
        label: 'Germany',
        isServiceManaged: false,
        concurrentMonitors: 1,
        agentPolicyId: 'germany',
      },
    ];
    const monitors = [
      {
        locations: ['us_central'],
        type: 'icmp',
        id: 'Cloudflare-DNS',
        name: 'Cloudflare DNS',
        hosts: ['1.1.1.1'],
        schedule: 1,
        tags: ['service:smtp', 'org:google'],
        privateLocations: ['Test private location 0'],
        timeout: '1m',
        wait: '30s',
        'service.name': 'test service',
      },
      {
        locations: ['us_central'],
        type: 'icmp',
        id: 'Cloudflare-DNS-2',
        name: 'Cloudflare DNS 2',
        hosts: '1.1.1.1',
        schedule: 1,
        tags: 'tag1,tag2',
        privateLocations: ['Test private location 0'],
        wait: '1m',
        service: {
          name: 'test service',
        },
      },
      {
        locations: ['us_central'],
        type: 'icmp',
        id: 'Cloudflare-DNS-3',
        name: 'Cloudflare DNS 3',
        hosts: '1.1.1.1,2.2.2.2',
        schedule: 1,
        tags: 'tag1,tag2',
        privateLocations: ['Test private location 0'],
        unsupportedKey: {
          nestedUnsupportedKey: 'unnsuportedValue',
        },
      },
    ];

    it('properly normalizes icmp monitors', () => {
      const actual = normalizeProjectMonitors({
        locations,
        privateLocations,
        monitors,
        projectId,
        namespace: 'test-space',
        version: '8.5.0',
      });
      expect(actual).toEqual([
        {
          errors: [],
          normalizedFields: {
            config_id: '',
            custom_heartbeat_id: 'Cloudflare-DNS-test-project-id-test-space',
            enabled: true,
            form_monitor_type: 'icmp',
            hosts: '1.1.1.1',
            journey_id: 'Cloudflare-DNS',
            locations: [
              {
                geo: {
                  lat: 33.333,
                  lon: 73.333,
                },
                id: 'us_central',
                isServiceManaged: true,
                label: 'Test Location',
                status: 'ga',
                url: 'test-url',
              },
            ],
            name: 'Cloudflare DNS',
            namespace: 'test_space',
            origin: 'project',
            original_space: 'test-space',
            project_id: 'test-project-id',
            schedule: {
              number: '1',
              unit: 'm',
            },
            'service.name': 'test service',
            tags: ['service:smtp', 'org:google'],
            timeout: '60',
            type: 'icmp',
            wait: '30',
          },
          unsupportedKeys: [],
        },
        {
          errors: [],
          normalizedFields: {
            config_id: '',
            custom_heartbeat_id: 'Cloudflare-DNS-2-test-project-id-test-space',
            enabled: true,
            form_monitor_type: 'icmp',
            hosts: '1.1.1.1',
            journey_id: 'Cloudflare-DNS-2',
            locations: [
              {
                geo: {
                  lat: 33.333,
                  lon: 73.333,
                },
                id: 'us_central',
                isServiceManaged: true,
                label: 'Test Location',
                status: 'ga',
                url: 'test-url',
              },
            ],
            name: 'Cloudflare DNS 2',
            namespace: 'test_space',
            origin: 'project',
            original_space: 'test-space',
            project_id: 'test-project-id',
            schedule: {
              number: '1',
              unit: 'm',
            },
            'service.name': 'test service',
            tags: ['tag1', 'tag2'],
            timeout: '16',
            type: 'icmp',
            wait: '60',
          },
          unsupportedKeys: [],
        },
        {
          errors: [
            {
              details:
                'Multiple hosts are not supported for icmp project monitors in 8.5.0. Please set only 1 host per monitor. You monitor was not created or updated.',
              id: 'Cloudflare-DNS-3',
              reason: 'Unsupported Heartbeat option',
            },
            {
              details:
                'The following Heartbeat options are not supported for icmp project monitors in 8.5.0: unsupportedKey.nestedUnsupportedKey. You monitor was not created or updated.',
              id: 'Cloudflare-DNS-3',
              reason: 'Unsupported Heartbeat option',
            },
          ],
          normalizedFields: {
            config_id: '',
            custom_heartbeat_id: 'Cloudflare-DNS-3-test-project-id-test-space',
            enabled: true,
            form_monitor_type: 'icmp',
            hosts: '1.1.1.1',
            journey_id: 'Cloudflare-DNS-3',
            locations: [
              {
                geo: {
                  lat: 33.333,
                  lon: 73.333,
                },
                id: 'us_central',
                isServiceManaged: true,
                label: 'Test Location',
                status: 'ga',
                url: 'test-url',
              },
            ],
            name: 'Cloudflare DNS 3',
            namespace: 'test_space',
            origin: 'project',
            original_space: 'test-space',
            project_id: 'test-project-id',
            schedule: {
              number: '1',
              unit: 'm',
            },
            'service.name': '',
            tags: ['tag1', 'tag2'],
            timeout: '16',
            type: 'icmp',
            wait: '1',
          },
          unsupportedKeys: ['unsupportedKey.nestedUnsupportedKey'],
        },
      ]);
    });
  });
});

import nock from 'nock';
import { Client } from '@vonage/server-client';
import { Auth } from '@vonage/auth';
import { AuditEvent, AuditEventTypes, Audit } from '../lib';

const BASE_URL = 'https://api.nexmo.com/';

const createEvent = (event: Partial<AuditEvent>): Partial<AuditEvent> => ({
  id: event.id,
  eventType: event.eventType,
  createdAt: '2022-11-15T17:30:33',
  userEmail: event.userEmail,
  userId: event.userId,
  accountId: event.accountId,
  source: event.source,
  sourceDescription: event.sourceDescription,
  sourceCountry: event.sourceCountry,
  context: event.context,
});

describe('Audit Events', () => {
  let client: Audit;

  beforeEach(function () {
    client = new Audit(new Auth({ apiKey: '12345', apiSecret: 'ABCDE' }));
  });

  afterEach(function () {
    nock.cleanAll();
  });

  test('Can get events on one page', async () => {
    const scope = nock(BASE_URL, {
      reqheaders: {
        authorization: 'Basic MTIzNDU6QUJDREU=',
      },
    })
      .intercept('/beta/audit/events?page=1', 'GET')
      .reply(200, {
        _embedded: {
          events: [createEvent({ id: '1' })].map((event) =>
            Client.transformers.snakeCaseObjectKeys(event),
          ),
        },
        page: {
          size: 20,
          totalElements: 1,
          totalPages: 1,
          page: 1,
        },
      });

    const results = client.getEvents({});
    const eventIter = await results.next();
    expect((eventIter.value as AuditEvent).id).toBe('1');
    expect((eventIter.value as AuditEvent).createdAt).toBe('2022-11-15T17:30:33');
    expect(scope.isDone()).toBeTruthy();
  });

  test('Can get events on multiple pages', async () => {
    // We're also checking AuditParams converts to snake_case
    const eventParameters = new URLSearchParams([
      ['event_type', String(AuditEventTypes.ACCOUNT_SECRET_CREATE)],
      ['date_from', String(createEvent({}).createdAt)],
      ['date_to', String(createEvent({}).createdAt)],
      ['search_text', 'fizz-buzz'],
      ['page', '2'],
      ['size', '21'],
    ]);

    const events: Array<AuditEvent> = [];
    const clientParams = Client.transformers.camelCaseObjectKeys(
      Object.fromEntries(eventParameters),
    );

    const scope = nock(BASE_URL, {
      reqheaders: {
        authorization: 'Basic MTIzNDU6QUJDREU=',
      },
    })
      .intercept(
        `/beta/audit/events?${eventParameters.toString()}`,
        'GET',
      )
      .reply(200, {
        _embedded: {
          events: [
            createEvent({ id: '1' }),
            createEvent({ id: '2' }),
          ].map((event) => Client.transformers.snakeCaseObjectKeys(event)),
        },
        page: {
          size: 20,
          totalElements: 3,
          totalPages: 3,
          page: 2,
        },
      });

    eventParameters.set('page', '3');
    scope
      .intercept(
        `/beta/audit/events?${eventParameters.toString()}`,
        'GET',
      )
      .reply(200, {
        _embedded: {
          events: [createEvent({ id: '3' })].map((event) =>
            Client.transformers.snakeCaseObjectKeys(event),
          ),
        },
        page: {
          size: 20,
          totalElements: 3,
          totalPages: 2,
          page: 3,
        },
      });

    for await (const event of client.getEvents(clientParams)) {
      events.push(event);
    }

    expect(events[0].id).toBe('1');
    expect(events[1].id).toBe('2');
    expect(events[2].id).toBe('3');
    expect(scope.isDone()).toBeTruthy();
  });

  test('Throws exception when request fails', async () => {
    const scope = nock(BASE_URL, {
      reqheaders: {
        authorization: 'Basic MTIzNDU6QUJDREU=',
      },
    })
      .intercept('/beta/audit/events?page=1', 'GET')
      .reply(401, {
        status: 401,
        error: 'Unauthorized',
        message: 'Failed',
      });

    const results = client.getEvents({});

    await expect(results.next()).rejects.toThrow(
      'Request failed with status code 401',
    );

    expect(scope.isDone()).toBeTruthy();
  });

  test('Can get event', async () => {
    const scope = nock('https://api.nexmo.com/', {
      reqheaders: {
        authorization: 'Basic MTIzNDU6QUJDREU=',
      },
    })
      .intercept('/beta/audit/events/asdf', 'GET')
      .reply(200, {
        id: 'asdf',
        created_at: '2022-11-15T17:30:33',
      });

    const result = await client.getEvent('asdf');

    expect(result).toEqual({
      id: 'asdf',
      createdAt: '2022-11-15T17:30:33',
    });
    expect(scope.isDone()).toBeTruthy();
  });
});

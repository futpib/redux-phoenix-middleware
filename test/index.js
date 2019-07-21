
import path from 'path';

import {
	flip,
	append,
	propEq,
} from 'ramda';

import test from 'ava';

import execa from 'execa';
import pRetry from 'p-retry';

import WebSocket from 'isomorphic-ws';
import { fetish, baseUrl } from 'fetish';

import {
	createStore,
	combineReducers,
	applyMiddleware,
} from 'redux';

import {
	createPhoenixReducer,
	createPhoenixMiddleware,
	phoenixSocketStateSelector,
	phoenixChannelStateSelector,
	phoenixEventActionType,
} from '../src';

const BASE_URL = 'http://localhost:4000';

const client = fetish.with(baseUrl(BASE_URL));

const waitFor = (store, predicate) => new Promise(resolve => {
	const check = () => {
		const state = store.getState();
		const result = predicate(state);
		if (result) {
			unsubscribe();
			resolve({ state, result });
		}
	};

	const unsubscribe = store.subscribe(check);
	check();
});

const initialState = {
	log: [],
};

const logReducer = flip(append);

const mix = arguments_ => execa('mix', arguments_, {
	cwd: path.join(__dirname, 'fixtures', 'mock_backend'),
	stdio: 'inherit',
});

test.before(async t => {
	await mix([ 'deps.get' ]);
	const mockBackendProcess = mix([ 'phx.server' ]);

	Object.assign(t.context, { mockBackendProcess });

	await pRetry(async () => {
		try {
			return await client.get('/api/status');
		} catch (error) {
			if (error.code === 'ECONNREFUSED') {
				throw error;
			}

			throw new pRetry.AbortError(error);
		}
	});
});

test.after.always(async t => {
	const { mockBackendProcess } = t.context;

	await mockBackendProcess.cancel();
});

test('connect, join and receive a message', async t => {
	const phoenixReducer = createPhoenixReducer();
	const phoenixMiddleware = createPhoenixMiddleware({
		sockets: {
			socket: {
				endPoint: BASE_URL + '/socket',
				mapStateToSocketOptions: () => ({
					transport: WebSocket,
				}),
				channels: {
					'room:lobby': true,
				},
			},
		},
	});

	const store = createStore(combineReducers({
		log: logReducer,
		phoenix: phoenixReducer,
	}), initialState, applyMiddleware(phoenixMiddleware));

	store.dispatch({ type: 'dummy' });

	// Wait for the connection
	await waitFor(store, state => phoenixSocketStateSelector(state.phoenix, 'socket') === 'open');

	// Wait for the room join
	await waitFor(store, state => phoenixChannelStateSelector(state.phoenix, 'socket', 'room:lobby') === 'joined');

	setTimeout(() => console.log(store.getState()), 5000);

	// Wait for an action sent by the server after join
	const { result } = await waitFor(store, state => state.log.find(propEq('type', phoenixEventActionType('socket', 'room:lobby', 'after_join'))));

	t.deepEqual(result.payload, {
		test: 'after_join_payload',
	});

	t.deepEqual(result.meta.phoenix, {
		channel: 'room:lobby',
		event: 'after_join',
		socket: 'socket',
	});

	t.pass();
});

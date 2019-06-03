
import {
	forEachObjIndexed,
	lensPath,
	lensProp,
	view,
	set,
	compose,
	not,
	startsWith,
	anyPass,
	curry,
	path,
} from 'ramda';
import { Socket, Channel } from 'phoenix';

const alwaysTrue = () => true;
const alwaysEmpty = () => ({});

export const { isLifecycleEvent } = Channel.prototype;
export const isReplyEvent = startsWith('chan_reply_');
export const isReservedEvent = anyPass([ isLifecycleEvent, isReplyEvent ]);
export const isNotReservedEvent = compose(not, isReservedEvent);

export const phoenixEventActionType = curry((socket, channel, event) => {
	return [ 'phoenix', socket, channel, event ].join('/');
});

export const defaultMapEventToAction = (event, payload, channel, socket) => ({
	type: phoenixEventActionType(socket, channel, event),
	payload,
	meta: {
		phoenix: {
			socket,
			channel,
			event,
		},
	},
});

export const phoenixSocketLifecycleActionType = curry((socket, lifecycleEvent) => {
	return [ 'phoenix', '@socket-lifecycle', socket, lifecycleEvent ].join('/');
});

const phoenixSocketLifecycleAction = (socket, lifecycleEvent, payload) => ({
	type: phoenixSocketLifecycleActionType(socket, lifecycleEvent),
	payload,
	meta: {
		phoenix: {
			socket,
			lifecycleEvent,
		},
	},
});

export const phoenixChannelLifecycleActionType = curry((socket, channel, lifecycleEvent) => {
	return [ 'phoenix', '@channel-lifecycle', socket, channel, lifecycleEvent ].join('/');
});

const phoenixChannelLifecycleAction = (socket, channel, lifecycleEvent, payload) => ({
	type: phoenixChannelLifecycleActionType(socket, channel, lifecycleEvent),
	payload,
	meta: {
		phoenix: {
			socket,
			channel,
			lifecycleEvent,
		},
	},
});

export const createPhoenixMiddleware = options => store => {
	let sockets = {};
	let channels = {};

	const storeSocketListener = ({
		endPoint,
		mapStateToShouldBeConnected = alwaysTrue,
		mapStateToSocketOptions = alwaysEmpty,
		channels,
	}, socketKey, state) => {
		const socketLens = lensProp(socketKey);
		let socket = view(socketLens, sockets);
		const connectionState = socket && socket.connectionState();
		const shouldBeConnected = mapStateToShouldBeConnected(state);

		if (shouldBeConnected && (!socket || (connectionState === 'closed' && socket.closeWasClean))) {
			if (!socket) {
				const options = mapStateToSocketOptions(state);
				socket = new Socket(endPoint, options);

				socket.onOpen(payload => store.dispatch(phoenixSocketLifecycleAction(socketKey, 'open', payload)));
				socket.onClose(payload => store.dispatch(phoenixSocketLifecycleAction(socketKey, 'close', payload)));
				socket.onError(payload => store.dispatch(phoenixSocketLifecycleAction(socketKey, 'error', payload)));

				sockets = set(socketLens, socket, sockets);
			}

			socket.connect();
		}

		if (!shouldBeConnected && socket && connectionState === 'open') {
			socket.disconnect(() => {
				// XXX: Workaround for https://github.com/phoenixframework/phoenix/issues/3378
				store.dispatch(phoenixSocketLifecycleAction(socketKey, 'close', 'disconnect'));
			});
			sockets = set(socketLens, null, sockets);
		}

		if (!socket) {
			return;
		}

		forEachObjIndexed((value, channelKey) => {
			return storeChannelListener(value, channelKey, socketKey, socket, shouldBeConnected, state);
		}, channels);
	};

	const storeChannelListener = ({
		mapStateToShouldBeJoined = alwaysTrue,
		mapStateToChannelOptions = alwaysEmpty,
		shouldMapEventToAction = isNotReservedEvent,
		mapEventToAction = defaultMapEventToAction,
	}, channelKey, socketKey, socket, shouldBeConnected, state) => {
		const channelLens = lensPath([ socketKey, channelKey ]);
		let channel = view(channelLens, channels);
		const shouldBeJoined = shouldBeConnected && mapStateToShouldBeJoined(state);

		if (shouldBeJoined && (!channel || channel.state === 'closed')) {
			if (!channel) {
				const { params } = mapStateToChannelOptions(state);
				channel = socket.channel(channelKey, params);

				channel.onMessage = (event, payload) => {
					if (!shouldMapEventToAction(event, payload)) {
						return payload;
					}

					const action = mapEventToAction(event, payload, channelKey, socketKey);

					store.dispatch(action);

					return payload;
				};

				channel.onClose(payload => {
					store.dispatch(phoenixChannelLifecycleAction(socketKey, channelKey, 'close', payload));
				});
				channel.onError(payload => {
					store.dispatch(phoenixChannelLifecycleAction(socketKey, channelKey, 'error', payload));
				});

				channels = set(channelLens, channel, channels);
			}

			channel.join().receive('ok', () => {
				// XXX: Workaround for https://github.com/phoenixframework/phoenix/issues/3379
				store.dispatch(phoenixChannelLifecycleAction(socketKey, channelKey, 'join', 'join'));
			});
		}

		if (!shouldBeJoined && channel && channel.state === 'joined') {
			channel.leave();
			channels = set(channelLens, null, channels);
		}
	};

	return next => action => {
		const state = store.getState();
		forEachObjIndexed((value, key) => storeSocketListener(value, key, state), options.sockets);

		return next(action);
	};
};

export const createPhoenixReducer = () => (state = {}, action) => {
	if (action.type.startsWith('phoenix/@socket-lifecycle/')) {
		const { socket, lifecycleEvent } = action.meta.phoenix;
		const stateLens = lensPath([ 'sockets', socket, 'state' ]);

		if (lifecycleEvent === 'open') {
			return set(stateLens, 'open', state);
		}

		if (lifecycleEvent === 'close') {
			return set(stateLens, 'closed', state);
		}

		return state;
	}

	if (action.type.startsWith('phoenix/@channel-lifecycle/')) {
		const { socket, channel, lifecycleEvent } = action.meta.phoenix;
		const stateLens = lensPath([ 'sockets', socket, 'channels', channel, 'state' ]);

		if (lifecycleEvent === 'error') {
			return set(stateLens, 'errored', state);
		}

		if (lifecycleEvent === 'join') {
			return set(stateLens, 'joined', state);
		}

		return state;
	}

	return state;
};

export const phoenixSocketStateSelector = (phoenixState, socket) => {
	return path([ 'sockets', socket, 'state' ], phoenixState) || 'closed';
};

export const phoenixChannelStateSelector = (phoenixState, socket, channel) => {
	return path([ 'sockets', socket, 'channels', channel, 'state' ], phoenixState) || 'closed';
};

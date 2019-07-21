# redux-phoenix-middleware

> Declarative automatic bidirectional maping between Redux Actions and Phoenix Channel Messages

[![Build Status](https://travis-ci.org/futpib/redux-phoenix-middleware.svg?branch=master)](https://travis-ci.org/futpib/redux-phoenix-middleware) [![Coverage Status](https://coveralls.io/repos/github/futpib/redux-phoenix-middleware/badge.svg?branch=master)](https://coveralls.io/github/futpib/redux-phoenix-middleware?branch=master)

## Example

```js
import {
	createPhoenixReducer,
	createPhoenixMiddleware,
	phoenixSocketStateSelector,
	phoenixChannelStateSelector,
	phoenixEventActionType,
} from 'redux-phoenix-middleware';

const phoenixReducer = createPhoenixReducer();
const phoenixMiddleware = createPhoenixMiddleware({
	sockets: {
		socket: {
			// Sockets are automatically connected by default
			endPoint: BASE_URL + '/socket',
			channels: {
				// Channels are automatically joined (once the socket is connected) by default
				'room:lobby': true,
			},
		},
	},
});

// Keeps a log of messages sent to the `lobby` room
const messagesReducer = (state = [], action) => {
	// Got a channel event, could've been sent like `broadcast!(socket, "message", %{ ... })`
	if (action.type === phoenixEventActionType('socket', 'room:lobby', 'message')) {
		return state.concat(action.payload);
	}

	return state;
};

const store = createStore(combineReducers({
	messages: messagesReducer,
	phoenix: phoenixReducer,
}), initialState, applyMiddleware(phoenixMiddleware));

// Somwhere else:

const state = store.getState();

phoenixSocketStateSelector(state.phoenix, 'socket') === 'open'; // or 'closed'
phoenixChannelStateSelector(state.phoenix, 'socket', 'room:lobby') === 'joined'; // or 'closed', 'errored'
```

## Install

```
yarn add redux-phoenix-middleware
```

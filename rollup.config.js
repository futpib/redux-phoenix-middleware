import babel from 'rollup-plugin-babel';

const base = {
	input: 'src/index.js',
	plugins: [
		babel({
			babelrc: false,
			plugins: [
				'ramda',
			],
		}),
	],
};

export default [ {
	...base,
	output: {
		file: 'dist/index.js',
		format: 'cjs',
	},
}, {
	...base,
	output: {
		file: 'es/index.js',
		format: 'esm',
	},
} ];

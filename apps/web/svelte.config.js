import adapter from '@sveltejs/adapter-node';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter({
			// Output directory matches what the Dockerfile expects
			out: 'build'
		})
	}
};

export default config;

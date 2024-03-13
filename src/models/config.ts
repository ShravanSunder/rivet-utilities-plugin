import { pineconePlugin, type PluginConfigurationSpec } from '@ironclad/rivet-core';

export const configKeys = {
	pineconeApiKey: 'pineconeApiKey',
} as const;

export const pluginConfig = {
	pineconeApiKey: {
		type: 'secret',
		label: 'Pinecone API Key',
		description: 'The API key for the Pinecone service.',
		pullEnvironmentVariable: 'PINECONE_API_KEY',
		helperText: 'You may also set the PINECONE_API_KEY environment variable.',
	},
} as const satisfies Record<keyof typeof configKeys, PluginConfigurationSpec>;

<h1 align="center"><img src="https://rivet.ironcladapp.com/img/logo-banner-wide.png" alt="Rivet Logo"></h1>

## Description

This is an utilities plugin for rivet

### Iterator Node

The iterator Node will It will map through an array of object inputs `objectDataValues[][]`. The plugin will then call the subgraph you'd like to execute for item in the array.  Additionally

- it has a `chunkSize` option to limit the number of concurrent executions.
- it has a `cache` option to cache subgraph outputs of successful item runs.

### Pinecone Search Node

The node will allow you to query pinecone for vectors.  Allows `filters with metadata`.   It also allows you to get `scores` back from the api.  These are the reason to use this over the default Vector Retreival node in rivet.

### Pinecone Upsert Node

This node will allow

## Installation

See [Rivet Plugins](https://rivet.ironcladapp.com/docs/user-guide/plugins) for more details

### Using Iterator

Once install you can use it as show in the examples below.  Make sure the inputs are DataValues.

### Inputs

Inputs must be an array of objects to iterate over.  Each object in the array should be a ObjectDataValue `{type: 'object', value: <graph inputs>}`; where `<graph inputs>` is of the format `{type: `object `, value: {<graph input id>: <input value>}}` The graph input id should match the graph's input ports.  The input value should be a DataValue.

### Outputs

Ouputs will be an array of ObjectDataValue `type: `object `, value: {<graph output id>: <output value>}`

![1709682618198](image/README/1709682618198.png)

![1709682622326](image/README/1709682622326.png)

### Using Pinecone Nodes

Pinecone search node

![1710344219550](image/README/1710344219550.png)

Pinecone upsert node

![pinecone upsert](image/README/pinecone-upsert.png)

## Breaking changes

v0.3.0 has renamed the Iterator Node (from Iterator Plugin Node).  You'll have to readd the node

## Source

This was forked from: This project is an example of a [Rivet](https://github.com/Ironclad/rivet) plugin. It is a minimal TypeScript Rivet plugin that adds a single node called Example Plugin Node.

> See [Rivet Example Plugin](https://github.com/Ironclad/rivet) on details on plugin architecture and building it

Use `pnpm` to build and install

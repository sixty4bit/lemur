import React from 'react';
import ReactDOM from 'react-dom';
import { ApolloClient, InMemoryCache, ApolloProvider } from '@apollo/client';
import App from './App';
import config from './config.json';

const client = new ApolloClient({
  uri: config.apiUrl,
  cache: new InMemoryCache(),
  headers: {
    'x-api-key': config.apiKey,
  },
});

ReactDOM.render(
  <ApolloProvider client={client}>
    <App />
  </ApolloProvider>,
  document.getElementById('root')
);

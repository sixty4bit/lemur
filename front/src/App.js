import React, { useState } from 'react';
import { useQuery, useMutation, gql } from '@apollo/client';

const LIST_EMAILS = gql`
    query ListEmails {
        listEmails {
            id
            address
        }
    }
`;

const ADD_EMAIL = gql`
    mutation AddEmail($address: String!) {
        addEmail(address: $address) {
            id
            address
        }
    }
`;

function EmailForm({ onAddEmail }) {
  const [newEmail, setNewEmail] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onAddEmail(newEmail);
    setNewEmail('');
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={newEmail}
        onChange={(e) => setNewEmail(e.target.value)}
        placeholder="Enter email address"
        required
      />
      <button type="submit">Add Email</button>
    </form>
  );
}

function EmailList({ emails }) {
  return (
    <ul>
      {emails.map(({ id, address }) => (
        <li key={id}>{address}</li>
      ))}
    </ul>
  );
}

function App() {
  const { loading, error, data } = useQuery(LIST_EMAILS);
  const [addEmail] = useMutation(ADD_EMAIL, {
    refetchQueries: [{ query: LIST_EMAILS }],
  });

  const handleAddEmail = (address) => {
    addEmail({ variables: { address } });
  };

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error.message}</p>;

  return (
    <div className="App">
      <header className="App-header">
        <h1>Lemur Email App</h1>
      </header>
      <main>
        <EmailForm onAddEmail={handleAddEmail} />
        <EmailList emails={data.listEmails} />
      </main>
    </div>
  );
}

export default App;

import React from 'react';
import ReactDOM from 'react-dom';
import { hot } from 'react-hot-loader';
import App from './features/tab/App';

const Root = hot(module)(() => <App />);

ReactDOM.render(<Root />, document.getElementById('root'));

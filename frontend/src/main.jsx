import React from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter,Routes,Route} from 'react-router-dom';
import {Provider} from './context.jsx';
import {Layout} from './components.jsx';
import Home from './Home.jsx';
import MapPage from './MapPage.jsx';
import Simulator from './Simulator.jsx';
import {Scenarios,ScenarioDetail,Leaderboard,Compare} from './Scenarios.jsx';
import Methodology from './Methodology.jsx';
import WhatIf from './WhatIf.jsx';
import District from './District.jsx';
import Login,{AuthGate} from './Auth.jsx';
import Presentation from './Presentation.jsx';
import './styles.css';
createRoot(document.getElementById('root')).render(<BrowserRouter><Provider><Layout><Routes><Route path="/" element={<Home/>}/><Route path="/map" element={<MapPage/>}/><Route path="/simulator" element={<AuthGate><Simulator/></AuthGate>}/><Route path="/login" element={<Login/>}/><Route path="/district/:id" element={<District/>}/><Route path="/scenarios" element={<AuthGate><Scenarios/></AuthGate>}/><Route path="/scenarios/:id" element={<AuthGate><ScenarioDetail/></AuthGate>}/><Route path="/share/:id" element={<ScenarioDetail shared/>}/><Route path="/leaderboard" element={<Leaderboard/>}/><Route path="/compare" element={<AuthGate><Compare/></AuthGate>}/><Route path="/vision" element={<District/>}/><Route path="/presentation" element={<Presentation/>}/><Route path="/advisor" element={<AuthGate><WhatIf/></AuthGate>}/><Route path="/methodology" element={<Methodology/>}/><Route path="*" element={<Home/>}/></Routes></Layout></Provider></BrowserRouter>);
import './office.css';

import './district.css';

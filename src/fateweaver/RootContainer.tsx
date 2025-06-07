import React, { Component } from 'react';
import CurrentBoard from './components/CurrentBoard';
import ActionConfiguration from './components/ActionConfiguration';
import PermutationEstimation from './components/PermutationEstimation';
import ComputeControl from './components/ComputeControl';
import UtilityDefinition from './components/UtilityDefinition';
import ResultDisplay from './components/ResultDisplay';
import ImportExport from './components/ImportExport';

export default class RootContainer extends Component {
  render() {
    return (
      <div className="container mt-5">
        <div className="row justify-content-center">
          <div className="col-12">
            <CurrentBoard />
            <ActionConfiguration />
            <PermutationEstimation />
            <UtilityDefinition />
            <ComputeControl />
            <ResultDisplay />
            <ImportExport />
          </div>
        </div>
      </div>
    );
  }
}
import React, { Component, ReactNode } from 'react';

interface RootContainerProps {
  children?: ReactNode;
}

interface RootContainerState {}

export default class RootContainer extends Component<RootContainerProps, RootContainerState> {
  constructor(props: RootContainerProps) {
    super(props);
    this.state = {};
  }

  render() {
    return (
      <div className="App">
        <header className="App-header">
          123
          {this.props.children}
        </header>
      </div>
    );
  }
}
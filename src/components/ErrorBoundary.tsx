import React, { Component, ReactNode } from "react";
import { Card, Heading, Text, Button } from "@stellar/design-system";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Card>
          <Heading as="h3" size="sm">
            Something went wrong
          </Heading>
          <Text as="p" size="sm" style={{ marginTop: "0.5rem" }}>
            {this.state.error?.message || "An unexpected error occurred"}
          </Text>
          <div style={{ marginTop: "1rem" }}>
            <Button size="md" variant="primary" onClick={this.handleReset}>
              Try again
            </Button>
          </div>
        </Card>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

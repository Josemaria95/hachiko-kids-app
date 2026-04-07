import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import * as Sentry from "@sentry/react-native";
import { theme, fonts } from "../lib/theme";

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
  }

  handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.icon}>🐾</Text>
          <Text style={styles.title}>Algo salió mal</Text>
          <Text style={styles.body}>
            Luna necesita un momento. Intenta de nuevo.
          </Text>
          <TouchableOpacity style={styles.button} onPress={this.handleRetry}>
            <Text style={styles.buttonText}>Intentar de nuevo</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.bg,
    padding: 32,
  },
  icon: {
    fontSize: 56,
    marginBottom: 16,
  },
  title: {
    fontFamily: fonts.displayBold,
    fontSize: 24,
    color: theme.text,
    marginBottom: 8,
    textAlign: "center",
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: theme.textSecondary,
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 22,
  },
  button: {
    backgroundColor: theme.primary,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 16,
  },
  buttonText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    color: "#FFFFFF",
  },
});

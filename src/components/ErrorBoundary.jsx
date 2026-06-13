/* ====================================================================
   ERROR BOUNDARY
   ==================================================================== */

import { Component } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "./ui.jsx";
import { I18nContext } from "../i18n/I18nProvider.jsx";

/** Catches render errors and shows a friendly retry screen. */
export default class ErrorBoundary extends Component {
  static contextType = I18nContext;
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    const { t } = this.context;
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-stone-50 px-6 font-sans dark:bg-stone-950">
          <div className="max-w-md rounded-2xl border border-stone-200 bg-white p-8 text-center dark:border-stone-800 dark:bg-stone-900">
            <AlertTriangle className="mx-auto mb-3 text-amber-500" size={32} />
            <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100">{t("error.title")}</h2>
            <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
              {String(this.state.error?.message || this.state.error)}
            </p>
            <Button className="mt-6" onClick={() => this.setState({ error: null })}>
              <RotateCcw size={16} /> {t("error.tryAgain")}
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

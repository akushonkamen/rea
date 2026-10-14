import java.util.Map;

import ghidra.app.plugin.core.analysis.AutoAnalysisManager;
import ghidra.app.util.headless.HeadlessScript;

/** Apply one named auto-analyzer override before default auto-analysis. */
public final class ReaGhidraAnalysisOptions extends HeadlessScript {
    @Override
    public void run() throws Exception {
        String[] arguments = getScriptArgs();
        if (arguments.length != 2 || arguments[0].isBlank() || arguments[1].isBlank()) {
            throw new IllegalArgumentException(
                "ReaGhidraAnalysisOptions requires an analyzer-mode argument followed by one comma-separated analyzer-name argument");
        }
        String mode = arguments[0].trim();
        if (!"disable".equals(mode) && !"enable".equals(mode)) {
            throw new IllegalArgumentException("Unknown analyzer mode: " + mode);
        }
        String requestedState = "enable".equals(mode) ? "true" : "false";
        String[] names = arguments[1].split(",");
        AutoAnalysisManager analysis = AutoAnalysisManager.getAnalysisManager(currentProgram);
        Map<String, String> options = getCurrentAnalysisOptionsAndValues(currentProgram);
        for (String requestedName : names) {
            monitor.checkCancelled();
            String name = requestedName.trim();
            if (analysis.getAnalyzer(name) == null || !options.containsKey(name)) {
                throw new IllegalArgumentException("Unknown Ghidra analyzer for this program: " + name);
            }
        }
        for (String requestedName : names) {
            monitor.checkCancelled();
            setAnalysisOption(currentProgram, requestedName.trim(), requestedState);
        }
        options = getCurrentAnalysisOptionsAndValues(currentProgram);
        for (String requestedName : names) {
            monitor.checkCancelled();
            String name = requestedName.trim();
            if (!requestedState.equals(options.get(name))) {
                throw new IllegalStateException(
                    ("enable".equals(mode) ? "Ghidra analyzer remained disabled: " : "Ghidra analyzer remained enabled: ")
                        + name);
            }
        }
    }
}

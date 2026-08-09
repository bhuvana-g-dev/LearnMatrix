import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import AdminDashboardLayout from "./components/admin/AdminDashboardLayout";
import AdminLoginScreen from "./screens/admin/AdminLoginScreen";
import AdminDashboardScreen from "./screens/admin/AdminDashboardScreen";
import QuestionBankScreen from "./screens/admin/QuestionBankScreen";
import QuestionUploadScreen from "./screens/admin/QuestionUploadScreen";
import QuestionPreviewScreen from "./screens/admin/QuestionPreviewScreen";
import ResourceBankScreen from "./screens/admin/ResourceBankScreen";
import StudentRecordsScreen from "./screens/admin/StudentRecordsScreen";
import { useAdminAuth } from "./hooks/useAdminAuth";

/**
 * AdminApp.jsx — thin composition root for the Admin Panel, same pattern
 * as App.jsx for the student side. Kept as a fully separate tree (own
 * auth, own layout, own screens) so nothing about the existing student
 * app/frontend is touched. See RootRouter.jsx for how the two trees are
 * chosen between based on the URL.
 */
export default function AdminApp() {
  const auth = useAdminAuth();
  const [activeKey, setActiveKey] = useState("admin-dashboard");

  // Screen-level state: which question is being edited/previewed, and
  // whether a PDF-extracted row is pre-filling the Add Question form.
  const [editingQuestion, setEditingQuestion] = useState(null); // full question object, or null = Add mode
  const [prefillValues, setPrefillValues] = useState(null); // PDF-extracted candidate row
  const [previewQuestion, setPreviewQuestion] = useState(null);

  if (!auth.isAuthenticated) {
    return <AdminLoginScreen auth={auth} onSuccess={() => setActiveKey("admin-dashboard")} />;
  }

  // Guards against a mis-wired onClick handing this an Event instead of a
  // real PDF-extracted candidate row (that bug once caused "Converting
  // circular structure to JSON" on submit, since an Event object holds a
  // circular reference back to `window`). Only a plain object survives.
  const isPlainCandidate = (value) =>
    !!value &&
    typeof value === "object" &&
    !("nativeEvent" in value) &&
    !("target" in value) &&
    typeof value.Question === "string";

  const goToAddQuestion = (candidate) => {
    setEditingQuestion(null);
    setPrefillValues(isPlainCandidate(candidate) ? candidate : null);
    setActiveKey("question-upload");
  };

  const goToEditQuestion = (question) => {
    setEditingQuestion(question);
    setPrefillValues(null);
    setActiveKey("question-upload");
  };

  const goToPreview = (question) => {
    setPreviewQuestion(question);
    setActiveKey("question-preview");
  };

  const backToQuestionBank = () => {
    setEditingQuestion(null);
    setPrefillValues(null);
    setPreviewQuestion(null);
    setActiveKey("question-bank");
  };

  let content;
  if (activeKey === "admin-dashboard") {
    content = <AdminDashboardScreen onNavigate={setActiveKey} />;
  } else if (activeKey === "question-bank") {
    content = (
      <QuestionBankScreen
        onAddQuestion={goToAddQuestion}
        onEditQuestion={goToEditQuestion}
        onPreviewQuestion={goToPreview}
      />
    );
  } else if (activeKey === "question-upload") {
    content = (
      <QuestionUploadScreen
        initialValues={editingQuestion || prefillValues}
        isEditing={!!editingQuestion}
        onCancel={backToQuestionBank}
        onSaved={backToQuestionBank}
      />
    );
  } else if (activeKey === "question-preview") {
    content = <QuestionPreviewScreen question={previewQuestion} onBack={backToQuestionBank} />;
  } else if (activeKey === "resource-bank") {
    content = <ResourceBankScreen />;
  } else if (activeKey === "student-records") {
    content = <StudentRecordsScreen />;
  }

  return (
    <AdminDashboardLayout activeKey={activeKey} onNavigate={setActiveKey} onLogout={auth.logout}>
      <AnimatePresence mode="wait">
        <motion.div
          key={activeKey}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.25 }}
        >
          {content}
        </motion.div>
      </AnimatePresence>
    </AdminDashboardLayout>
  );
}

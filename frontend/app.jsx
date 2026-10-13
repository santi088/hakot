import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import Answer from "./Answer";
import Avatar from "./Avatar";

const topics = [
  { icon: "01", title: "Scholarships", text: "Explore grants and requirements", question: "What scholarships are available at UMak?" },
  { icon: "02", title: "College requirements", text: "Find your next step", question: "What are the requirements for Bachelor of Science in Information Technology?" },
  { icon: "03", title: "Campus locations", text: "Find your way around", question: "Where is the Medical and Dental Clinic located?" },
  { icon: "04", title: "University offices", text: "Know who to reach out to", question: "What services does the Office of the University Registrar provide?" },
];
const readableTitle = title => title.replaceAll("-", " ").replaceAll("_", " ");

function App() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const bottom = useRef(null);
  const input = useRef(null);
  const requestActive = useRef(false);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, pending, error]);

  async function ask(raw) {
    const text = raw.trim();
    if (!text || raw.length >= 300 || requestActive.current) return;
    requestActive.current = true;
    setPending(true);
    setError("");
    setQuestion("");
    setMessages(previous => [...previous, { role: "user", text }]);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 150000);
    try {
      const response = await fetch("/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text }),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(response.status === 429
          ? "You have reached the request limit. Please wait a minute and try again."
          : "We couldn't get an answer right now. Please try again.");
      }
      const result = await response.json();
      if (typeof result.answer !== "string" || !Array.isArray(result.sources)) throw new Error("The answer could not be loaded. Please try again.");
      setMessages(previous => [...previous, { role: "assistant", text: result.answer, sources: result.sources }]);
    } catch (failure) {
      setError(failure.name === "AbortError" ? "This response took too long. Please try again." : failure.message || "Connection failed. Please try again.");
      setQuestion(text);
    } finally {
      clearTimeout(timeout);
      requestActive.current = false;
      setPending(false);
      setTimeout(() => input.current?.focus(), 0);
    }
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <a href="/" className="brand" aria-label="Maki home"><Avatar /><span>Maki<span className="brand-caption">YOUR UMAK GUIDE</span></span></a>
        <div className="sidebar-body">
          <p className="eyebrow">A LITTLE GUIDANCE GOES A LONG WAY</p>
          <h2>University life,<br /><span>made clearer.</span></h2>
          <p className="sidebar-description">From scholarship questions to finding the right office. Start here.</p>
          <div className="topic-list">
            <p className="eyebrow">WHAT WE CAN HELP WITH</p>
            {topics.map(topic => <button key={topic.title} disabled={pending} onClick={() => { setQuestion(topic.question); input.current?.focus(); }}><span>{topic.icon}</span>{topic.title}<span className="arrow">↗</span></button>)}
          </div>
        </div>
        <div className="sidebar-footer"><span className="small-mark">U</span><div>University of Makati<br /><span>Information for the Heron community</span></div></div>
      </aside>
      <main>
        <header className="topbar"><span>THE STUDENT HELP DESK</span><span className="document-note"><i /> Answers with document references</span></header>
        <div className="conversation">
          <section className="welcome">
            <div className="welcome-greeting"><Avatar /><div><span className="welcome-label">HI, HERON! I'M MAKI</span><p>Your friendly guide to life at UMak.</p></div></div>
            <h1>A question today.<br /><span>A clearer path ahead.</span></h1>
            <p>Ask about UMak scholarships, college requirements,<br className="desktop-break" /> campus locations, and university offices.</p>
          </section>
          {messages.length === 0 && <div className="suggestions">{topics.map(topic => <button key={topic.title} onClick={() => ask(topic.question)} disabled={pending}><span className="suggestion-number">{topic.icon}</span><strong>{topic.title}</strong><span>{topic.text}</span><span className="suggestion-arrow">↗</span></button>)}</div>}
          <section className="messages" role="log" aria-label="Conversation" aria-live="polite" aria-relevant="additions">
            {messages.map((message, index) => <article key={index} className={"message " + message.role}>
              <div className="message-header"><Avatar user={message.role === "user"} /><div className="message-label">{message.role === "user" ? "You" : "Maki"}<span className="message-caption">{message.role === "user" ? "Your question" : "Your UMak guide"}</span></div></div>
              {message.role === "assistant" ? <Answer text={message.text} /> : <div className="message-text">{message.text}</div>}
              {message.sources?.length > 0 && <div className="sources"><p className="eyebrow">FROM THE DOCUMENTS · {message.sources.length} REFERENCES</p>{message.sources.map((source, i) => <details key={i}><summary><span className="source-number">{i + 1}</span><span><strong>{readableTitle(source.title)}</strong>{source.locator && <span className="locator">{source.locator}</span>}</span><span className="source-toggle">+</span></summary><p className="passage">{source.text}</p></details>)}</div>}
            </article>)}
            {pending && <div className="loading" role="status"><Avatar /><span className="loading-dot" /> Maki is checking the university documents…</div>}
          </section>
          {error && <div role="alert" className="error">{error}</div>}
          <div ref={bottom} />
        </div>
        <footer className="composer-area">
          <form onSubmit={event => { event.preventDefault(); ask(question); }} className="composer">
            <label className="sr-only" htmlFor="question">Your university question</label>
            <textarea id="question" ref={input} value={question} maxLength={299} disabled={pending} rows={2} placeholder="What would you like to know?" onChange={event => setQuestion(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); ask(question); } }} />
            <div className="composer-bottom"><span>{question.length}/299 <span className="keyboard-hint">· Enter to send</span></span><button type="submit" disabled={pending || !question.trim()} aria-label="Send question">{pending ? "Thinking…" : "Ask Maki"}<span aria-hidden="true">↑</span></button></div>
          </form>
          <p className="fine-print">Answers are based on the provided university documents. Check the references for details.</p>
        </footer>
      </main>
    </div>
  );
}
createRoot(document.getElementById("root")).render(<App />);
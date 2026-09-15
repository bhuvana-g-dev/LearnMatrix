  return (
    <PageShell>
      <div className="flex" style={{ minHeight: "100vh" }}>
        {/* Left — brand panel (hidden below lg, matches PageShell's navy/gold) */}
        <div
          className="hidden lg:flex flex-col justify-between flex-shrink-0"
          style={{
            width: "40%",
            padding: "52px 44px",
            background: `linear-gradient(160deg, ${COLORS.sky} 0%, #16264f 60%, ${COLORS.sky} 100%)`,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: -90,
              right: -70,
              width: 260,
              height: 260,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${COLORS.purple}30, transparent 70%)`,
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: -110,
              left: -60,
              width: 300,
              height: 300,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${COLORS.pink}22, transparent 70%)`,
              pointerEvents: "none",
            }}
          />

          <div style={{ position: "relative", zIndex: 1 }}>
            <Logo />
            <h2 className="text-[34px] font-bold mt-10 leading-tight" style={{ color: "#fff" }}>
              Your Learning Journey
              <br />
              <span style={{ color: COLORS.pink }}>Starts Here!</span>
            </h2>
            <p className="text-sm mt-4" style={{ color: "rgba(255,255,255,0.68)", maxWidth: 320, lineHeight: 1.6 }}>
              Create your account and get access to personalized learning paths, an AI study assistant, quizzes, and more.
            </p>
          </div>

          <div style={{ position: "relative", zIndex: 1 }} className="space-y-5">
            {[
              { Icon: GraduationCap, title: "Learn Smarter", sub: "Personalized learning paths" },
              { Icon: Target, title: "Practice Better", sub: "Quizzes & interactive content" },
              { Icon: TrendingUp, title: "Track Progress", sub: "See your growth in real time" },
              { Icon: Award, title: "Achieve Goals", sub: "Build your dream career" },
            ].map(({ Icon, title, sub }) => (
              <div key={title} className="flex items-center gap-3">
                <div
                  className="flex items-center justify-center flex-shrink-0"
                  style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(255,255,255,0.1)" }}
                >
                  <Icon size={18} color={COLORS.pink} />
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: "#fff" }}>{title}</p>
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>{sub}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)", position: "relative", zIndex: 1 }}>
            © {new Date().getFullYear()} LearnMatrix
          </p>
        </div>

        {/* Right — form panel (unchanged content, just moved into the split layout) */}
        <div className="flex-1 flex items-center justify-center px-4 py-10 overflow-y-auto" style={{ minHeight: "100vh" }}>
          <div className="w-full max-w-lg p-8" style={{ ...GLASS_CARD, borderRadius: 28 }}>
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="flex items-center gap-1.5 text-xs font-semibold mb-5"
                style={{ color: COLORS.textMid, background: "none", border: "none", cursor: "pointer" }}
              >
                <ArrowLeft size={14} /> Back to Home
              </button>
            )}

            <Logo />

            <h1 className="text-center text-2xl sm:text-3xl font-bold mt-5" style={{ color: COLORS.textDark }}>
              Create Account
            </h1>
            <p className="text-center text-sm mb-7" style={{ color: COLORS.textMid }}>
              Start your LearnMatrix journey
            </p>

            <div className="flex justify-center mb-6">
              <label style={{ cursor: "pointer" }}>
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center overflow-hidden"
                  style={{
                    background: avatarUrl ? "transparent" : GRADIENTS.purplePink,
                    boxShadow: "0 8px 20px rgba(192,132,252,0.4)",
                  }}
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <Camera size={22} color="#fff" />
                  )}
                </div>
                <input type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: "none" }} disabled={loading} />
              </label>
            </div>

            <div className="space-y-4">
              {/* First / Last name */}
              <div className="grid grid-cols-2 gap-3">
                <div style={{ position: "relative" }}>
                  <User size={17} style={{ position: "absolute", left: 15, top: "50%", transform: "translateY(-50%)" }} />
                  <input
                    style={inputStyle}
                    placeholder="First Name *"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    disabled={loading || !!successMessage}
                  />
                </div>
                <input
                  style={{ ...inputStyle, paddingLeft: 16 }}
                  placeholder="Last Name *"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  disabled={loading || !!successMessage}
                />
              </div>

              {/* Email */}
              <div style={{ position: "relative" }}>
                <Mail size={17} style={{ position: "absolute", left: 15, top: "50%", transform: "translateY(-50%)" }} />
                <input
                  type="email"
                  style={inputStyle}
                  placeholder="Email *"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading || !!successMessage}
                />
              </div>
              {emailSuggestion && (
                <button
                  type="button"
                  onClick={() => setEmail(emailSuggestion)}
                  className="text-xs font-semibold"
                  style={{
                    color: "#8B5CF6",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    marginTop: -8,
                    display: "block",
                  }}
                >
                  Did you mean {emailSuggestion}? Tap to fix
                </button>
              )}

              {/* Confirm Email */}
              <div style={{ position: "relative" }}>
                <Mail size={17} style={{ position: "absolute", left: 15, top: "50%", transform: "translateY(-50%)" }} />
                <input
                  type="email"
                  style={inputStyle}
                  placeholder="Confirm Email *"
                  value={confirmEmail}
                  onChange={(e) => setConfirmEmail(e.target.value)}
                  onPaste={(e) => e.preventDefault()}
                  disabled={loading || !!successMessage}
                />
              </div>
              {confirmEmail && email.trim() !== confirmEmail.trim() && (
                <p className="text-xs" style={{ color: "#E4568A", marginTop: -8 }}>
                  Emails don't match yet.
                </p>
              )}

              {/* Password / Confirm */}
              <div className="grid grid-cols-2 gap-3">
                <div style={{ position: "relative" }}>
                  <Lock size={17} style={{ position: "absolute", left: 15, top: "50%", transform: "translateY(-50%)" }} />
                  <input
                    type={showPw ? "text" : "password"}
                    style={{ ...inputStyle, paddingRight: 36 }}
                    placeholder="Password *"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading || !!successMessage}
                  />
                  <button
                    onClick={() => setShowPw(!showPw)}
                    type="button"
                    style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", border: "none", background: "none", cursor: "pointer" }}
                  >
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <input
                  type="password"
                  style={{ ...inputStyle, paddingLeft: 16 }}
                  placeholder="Confirm Password *"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading || !!successMessage}
                />
              </div>

              {/* Mobile */}
              <div style={{ position: "relative" }}>
                <Phone size={17} style={{ position: "absolute", left: 15, top: "50%", transform: "translateY(-50%)" }} />
                <span
                  className="text-sm font-medium"
                  style={{ position: "absolute", left: 40, top: "50%", transform: "translateY(-50%)", color: COLORS.textMid }}
                >
                  🇮🇳 +91
                </span>
                <input
                  type="tel"
                  style={{ ...inputStyle, paddingLeft: 92, paddingRight: phoneVerified ? 90 : 96 }}
                  placeholder="Mobile Number *"
                  value={mobile}
                  onChange={(e) => {
                    setMobile(e.target.value.replace(/\D/g, "").slice(0, 10));
                    if (phoneVerified || otpSent) {
                      setPhoneVerified(false);
                      setOtpSent(false);
                      setOtp("");
                      setOtpError("");
                    }
                  }}
                  disabled={loading || !!successMessage}
                />
                {phoneVerified ? (
                  <span
                    className="text-xs font-semibold flex items-center gap-1"
                    style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "#22C08E" }}
                  >
                    <CheckCircle2 size={14} /> Verified
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={sendingOtp || loading || !!successMessage || !MOBILE_REGEX.test(mobile.trim())}
                    className="text-xs font-semibold"
                    style={{
                      position: "absolute",
                      right: 10,
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "#8B5CF6",
                      background: "none",
                      border: "none",
                      cursor: MOBILE_REGEX.test(mobile.trim()) ? "pointer" : "default",
                      opacity: MOBILE_REGEX.test(mobile.trim()) ? 1 : 0.5,
                    }}
                  >
                    {sendingOtp ? "Sending..." : otpSent ? "Resend" : "Send OTP"}
                  </button>
                )}
              </div>

              {otpSent && !phoneVerified && (
                <div className="flex items-center gap-2">
                  <input
                    type="tel"
                    style={{ ...inputStyle, paddingLeft: 16, flex: 1 }}
                    placeholder="Enter 6-digit OTP"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    disabled={verifyingOtp || loading || !!successMessage}
                  />
                  <button
                    type="button"
                    onClick={handleVerifyOtp}
                    disabled={verifyingOtp || otp.length !== 6 || loading || !!successMessage}
                    className="text-sm font-semibold flex-shrink-0"
                    style={{
                      padding: "13px 18px",
                      borderRadius: 16,
                      border: "none",
                      background: GRADIENTS.purplePink,
                      color: "#fff",
                      cursor: otp.length === 6 ? "pointer" : "default",
                      opacity: otp.length === 6 ? 1 : 0.6,
                    }}
                  >
                    {verifyingOtp ? "Verifying..." : "Verify"}
                  </button>
                </div>
              )}
              {otpError && (
                <p className="text-xs" style={{ color: "red", marginTop: -8 }}>
                  {otpError}
                </p>
              )}

              {userType === "college" && (
                <>
                  <CollegeDropdown value={college} onChange={setCollege} disabled={loading || !!successMessage} />

                  <div style={{ position: "relative" }}>
                    <GraduationCap size={17} style={{ position: "absolute", left: 15, top: "50%", transform: "translateY(-50%)" }} />
                    <input
                      style={inputStyle}
                      placeholder="Department (e.g. B.Sc. Computer Science) *"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      disabled={loading || !!successMessage}
                    />
                  </div>

                  <div style={{ position: "relative" }}>
                    <CalendarDays size={17} style={{ position: "absolute", left: 15, top: "50%", transform: "translateY(-50%)" }} />
                    <input
                      style={inputStyle}
                      placeholder="Academic Year (e.g. Final Year (2027)) *"
                      value={academicYear}
                      onChange={(e) => setAcademicYear(e.target.value)}
                      disabled={loading || !!successMessage}
                    />
                  </div>
                </>
              )}

              <label className="flex items-start gap-2 text-xs" style={{ color: COLORS.textMid, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  disabled={loading || !!successMessage}
                  style={{ marginTop: 2 }}
                />
                <span>
                  All your information is collected, stored, and processed as per our data
                  processing guidelines. By signing up, you agree to our Privacy Policy and
                  Terms of Use.
                </span>
              </label>

              {error && (
                <p className="text-center text-sm" style={{ color: "red" }}>
                  {error}
                </p>
              )}

              {successMessage && (
                <div
                  className="flex items-start gap-2 text-sm p-3"
                  style={{ borderRadius: 14, background: "rgba(34,192,142,0.12)", color: "#22C08E" }}
                >
                  <CheckCircle2 size={16} className="flex-shrink-0 mt-0.5" />
                  <span>{successMessage}</span>
                </div>
              )}

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleSignup}
                disabled={loading || !!successMessage}
                className="w-full"
                style={{
                  padding: "14px",
                  borderRadius: 9999,
                  border: "none",
                  background: GRADIENTS.purplePink,
                  color: "#fff",
                  fontWeight: 700,
                  cursor: loading || successMessage ? "default" : "pointer",
                  opacity: loading || successMessage ? 0.8 : 1,
                }}
              >
                {successMessage ? "Redirecting..." : loading ? "Creating Account..." : "Continue"}
              </motion.button>

              <p className="text-center text-sm mt-4">
                Already have an account?{" "}
                <span onClick={onLogin} style={{ color: "#8B5CF6", cursor: "pointer", fontWeight: 700 }}>
                  Login
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}

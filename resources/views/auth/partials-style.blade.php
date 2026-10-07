    <style>
        .pid-auth {
            min-height: 100vh;
            display: grid;
            place-items: center;
            padding: 24px;
            background: var(--pid-bg);
        }
        .pid-auth__card {
            width: 100%;
            max-width: 360px;
            background: var(--pid-surface);
            border: 1px solid var(--pid-border);
            border-radius: var(--pid-radius);
            padding: 24px;
        }
        .pid-auth__title {
            margin: 0 0 4px;
            font-size: 18px;
            font-weight: 600;
            color: var(--pid-text);
        }
        .pid-auth__subtitle {
            margin: 0 0 20px;
            color: var(--pid-muted);
            font-size: 13px;
        }
        .pid-auth__field {
            display: block;
            margin-bottom: 14px;
            font-size: 13px;
            color: var(--pid-muted);
        }
        .pid-auth__field span {
            display: block;
            margin-bottom: 4px;
        }
        .pid-auth__input {
            width: 100%;
            padding: 8px 10px;
            border: 1px solid var(--pid-border);
            border-radius: 6px;
            background: var(--pid-surface);
            color: var(--pid-text);
            font: inherit;
            font-size: 14px;
        }
        .pid-auth__input:focus-visible {
            outline: 2px solid var(--pid-accent);
            outline-offset: 0;
            border-color: var(--pid-accent);
        }
        .pid-auth__remember {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 16px;
            font-size: 13px;
            color: var(--pid-muted);
        }
        .pid-auth__submit {
            width: 100%;
            padding: 9px 12px;
            border: 0;
            border-radius: 6px;
            background: var(--pid-accent);
            color: #fff;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
        }
        .pid-auth__submit:hover,
        .pid-auth__submit:focus-visible {
            outline: none;
            filter: brightness(1.05);
        }
        .pid-auth__alert {
            margin: 0 0 16px;
            padding: 10px 12px;
            background: var(--pid-danger-bg);
            color: var(--pid-danger-text);
            border-radius: 6px;
            font-size: 13px;
        }
        .pid-auth__alert ul {
            margin: 0;
            padding-left: 18px;
        }
    </style>

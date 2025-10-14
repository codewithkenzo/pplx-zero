# Security Writeups Collection

*Compiled from clipboard history - October 2025*

---

## 1. From Shodan to SQLi: Hacking an Exposed Company Dashboard
**Author:** Het Patel  
**Source:** InfoSec Write-ups  
**Date:** Aug 28, 2025  
**URL:** https://infosecwriteups.com/from-shodan-to-sqli-hacking-an-exposed-company-dashboard-0b66a37a54ea

### Overview
Uncovering vulnerabilities and exploiting them: a deep dive into the journey from reconnaissance to a successful SQL injection. This is a real-world case study detailing how an exposed company dashboard was identified and exploited, starting from a simple search on Shodan.

### The Reconnaissance Phase: Shodan's Power
While exploring Shodan one evening, I came across an exposed server running an outdated version of Apache. What started as simple reconnaissance quickly escalated into a full SQL injection that let me bypass login and access a company's internal dashboard.

This write-up highlights how **basic misconfigurations + outdated software + lack of input validation** can lead to severe compromises.

### Discovering the Login Page
When I visited the IP, I noticed that directory listing was enabled, which exposed several data files. When I visited the IP, I noticed that directory listing was enabled, which exposed several data files. I visited almost every data folder, but they eventually redirected me to a login screen. I tried a few password combinations, which obviously failed.

### Testing for SQL Injection
The first step was simple: I entered a single quote (`'`) into the username field. The application responded with a SQL syntax error. Jackpot.

**Database Error Occurred**

Error Number: 1064

You have an error in your SQL syntax; check the manual that corresponds to your MySQL server version for the right syntax to use near `'admin' LIMIT 1'` at line 3

```
SELECT * FROM (`user_login_details`) WHERE `user_name` ='admin'' and user_password='admin' LIMIT 1
```

Filename: C:\xampp\htdocs\DEMO\system\database\DB_driver.php

Line Number: 331

From there, I crafted a basic payload to extract more details. Error messages revealed database structure and confirmed the backend was vulnerable.

### Accessing the Dashboard
Well, Using a simple payload:
```
admin' AND 1=1#
```

I was able to bypass authentication and gain direct access to the company's internal dashboard.

The dashboard revealed whole internal system and at this point, I reported the issue to the company before digging any further. **Ethical hacking isn't about exploiting data; it's about securing it.**

### Conclusion
This story underscores the power of Shodan when combined with simple testing techniques like SQL injection. The best defense? Assume attackers are running these scans every day because they are.

For companies: never expose sensitive dashboards to the internet, always sanitize inputs, and ensure proper monitoring is in place.

For ethical hackers: sometimes all it takes is curiosity and persistence to uncover significant vulnerabilities.

---

## 2. The Tools I Use Every Day That Would Get Me Fired If I Had a Job
**Author:** Aeon Flex, Elriel Assoc. 2133 [NEON MAXIMA]  
**Source:** Medium  
**Date:** Jun 14, 2025  
**URL:** https://medium.com/@neonmaxima/the-tools-i-use-every-day-that-would-get-me-fired-if-i-had-a-job-4ec6c90f34f7

### Overview
I don't have a boss. That's not a brag, it's a symptom. If I had one, I'd be canned before lunchtime, probably before I even logged in. Because if you looked closely at what I run on my machine, you'd think I was either working for an intelligence agency or actively trying to dismantle one. But I'm not. I just don't trust anything I didn't patch together myself, and I don't believe in playing fair with systems designed to extract more from me than they return.

This is a list of the tools I use every single day. Tools that, if I had an employer with a company laptop, a security team, or even basic EDR, would send red flags exploding through whatever Slack thread they use to talk about risk. These aren't toys. They're lifelines. And the thing is, they're not illegal. Not really. But intent is everything. And my intent has never been to clock in and play nice.

### 1. Wireshark + Kismet + Bettercap
First thing I open in the morning isn't Gmail. It's Wireshark. Because I want to see what my machine is whispering to the world before I do anything. Wireshark lets me dissect every packet like a butcher. If something's phoning home, I know. If something's probing, I hear it.

Kismet runs quietly in the background when I'm on the move. It maps the WiFi around me and picks up on the patterns of who's where. Who's leaking what. It's how I spotted a fake cell tower outside a coffee shop last year. You don't forget something like that.

Bettercap is the scalpel. Man-in-the-middle attacks, spoofing, sniffing, ARP poisoning. If I want to see what someone's doing on the same network as me, I don't ask. I just fire up Bettercap and wait.

### 2. Tailscale + Tor + Proxychains + Snowflake
I don't touch the raw web unless I'm forced to. My machine is segmented with layers of networking tools. Tailscale links my devices across multiple networks without ever touching the public internet. It's how I remote in to my off-grid box hidden in a garage two states away. It's how I keep my backups flowing through an encrypted tunnel nobody knows exists.

Tor is for when I need to disappear completely. Not for surfing, not really. But for sending messages, bouncing traffic, watching nodes rise and fall.

Proxychains wraps certain programs in disguise. Think of it as a mask for apps that don't know how to hide. I route AI scraping jobs through five hops and a public university in Germany just because I can.

Snowflake is a little different. It's a pluggable transport. A circumvention tool designed to get through censorship. I don't live in China or Iran, but I test all my tools like I do. Because someday I might.

### 3. Obsidian + Logseq + Trilium
You might think these are innocent note-taking apps. But I use them as memory weapons. I've gutted them and modded the hell out of them to act like personal AI context stacks, infused with scraped PDFs, OSINT logs, darknet transcripts, and indexed chat logs from years of forum crawling.

My Trilium instance runs offline, encrypted, and has a UI skin I stole from a TempleOS replica. I write everything there. Drafts, code fragments, shopping lists, hate mail to companies that sold my data. It's my second brain, but the first one I actually trust.

Obsidian is wired to local scripts that ingest Reddit threads, GitHub issues, and archive.org captures. I don't bookmark. I trap and dissect. I store screenshots, hashes, and context trees in YAML.

### 4. ffuf + Dirbuster + Subfinder
These are web reconnaissance tools, usually reserved for pentesters. But I use them to map the guts of every SaaS platform I ever touch. Why? Because I don't want to be surprised. I don't want a new endpoint to go live without me knowing. If I'm storing anything online, I need to know how porous the walls are.

ffuf is fast. Real fast. And with the right wordlists, it'll crack open hidden admin panels, staging environments, forgotten dev subdomains. Dirbuster helps confirm. Subfinder pulls in all the loose ends the company forgot to hide in DNS.

### 5. ExifTool + Strings + Binwalk + Ghidra
I don't trust images. Or PDFs. Or anything really. ExifTool strips and checks metadata. I've pulled full GPS logs from photos sent over Discord. I've found usernames hidden in DOCX files. It's the kind of thing you check once, then never stop checking.

Strings and Binwalk are for embedded files. I open things people send me, or that I download from archive dumps, and I don't assume anything. A PNG might be a ZIP. A PDF might contain a backdoor.

Ghidra is the nuclear option. If a file looks weird, I reverse it. I'm not a genius with disassembly, but I know enough to follow the smell. I've found hardcoded credentials, weird callbacks, even obfuscated shell scripts baked into desktop software installers.

### 6. Yersinia + Scapy + Burp Suite Community
Yersinia is ancient and dangerous. It breaks networks on purpose. STP attacks, DHCP starvation, VLAN hopping. I keep it around not to destroy but to understand what's possible.

Scapy is programmable packet crafting. Think of it like Photoshop but for raw network traffic. I use it to build weird malformed packets and see how devices respond. It's like poking a corpse with a stick just to see if it twitches.

Burp Suite is mostly for web, but it's the GUI that matters. Proxy traffic, intercept, modify. Sometimes I just like watching what websites really send, behind the pretty JavaScript.

### 7. USB Rubber Ducky + Flipper Zero + Digispark clones
These are hardware tools. Real-world problems require real-world injections. The Ducky is a keystroke injection tool. Plug it into any computer, and it acts like a keyboard. I have payloads that open terminals, download scripts, and back up user files in under 15 seconds.

The Flipper Zero is the Swiss army knife. I've cloned hotel keycards, read NFC chips off bus passes, and sniffed infrared codes from remote controls. It's not a toy. It's a portable breach point.

Digispark clones are Ducky lite. Cheap enough to leave behind. I've made ones that auto-join open WiFi, download a payload, and self-destruct by overloading their own power rail.

### 8. Custom AI Tools (Local Claude Wrapper + Coder Assistants)
I don't use ChatGPT online. I run a local Claude API wrapper that feeds it my logs, notes, tool manuals, and forum posts from deep archives. I've trained it on how I speak, what I want, and what I build. It's like talking to myself if I were more competent.

I have a dev assistant AI that refactors stolen code into usable modules and scrapes Stack Overflow in the background. It's not legal. But it's efficient. It builds tools I prototype. It even asks if I'm OK. Which is more than most people.

### 9. Shodan + Censys + ZoomEye
I don't search Google anymore. I search the internet itself. These tools index open devices, unsecured webcams, SCADA systems, VoIP dashboards, and more. They're OSINT goldmines.

I once found a medical records portal with no login page, just sitting out there. I didn't touch it. But I archived the IP. Because next week it'll be gone, and the only thing left will be my memory.

### 10. Autohotkey + Hammerspoon + Espanso
People underestimate automation. Autohotkey on Windows, Hammerspoon on macOS, and Espanso on Linux. All of them replace my need for clicking. I automate my desktop like it's a war machine.

Certain keys launch scripts. Certain phrases expand into full notes or commands. Certain mouse gestures trigger AI summarization of the window under my cursor. It's not about saving time. It's about staying ahead of the slow death of repetition.

### 11. Amass + Maltego + Recon-ng
If I want to destroy someone, or understand them, I map their world. Amass does DNS enumeration and attack surface mapping. Maltego shows it visually. Recon-ng scripts it all together.

I don't use this for revenge. I use it for understanding. Who owns what. What companies are leaking. What domains are tied to that weird phishing email. Information isn't just power. It's ammunition.

### 12. Syncthing + Restic + VeraCrypt + rclone
Every file I touch is encrypted or spread across time. Syncthing keeps my machines in sync peer-to-peer. No cloud. Just me.

Restic backs it all up incrementally, and rclone pushes it to hidden encrypted buckets on remote endpoints. VeraCrypt seals things that need sealing. Like logs. Like exfiltrated data. Like draft letters I'll never send.

### Final Thoughts:
None of this is about crime. It's about control. I use these tools because I don't want to be surprised, compromised, or treated like cattle in a system that commodifies thought. If I worked a corporate job and IT scanned my device, I'd be called into a meeting. If HR saw my logs, I'd be flagged.

But I don't work there. I work here. In the quiet spaces between pings and packets. And every day, I open my machine, glance at the network around me, and smile. Because I know what's running. I know who's watching. And I know they're not watching me close enough.

If you ever want to be free, start by building a toolkit your boss would be afraid to understand. Then use it like it's your heartbeat.

---

## 3. Shodan Recon Tips
**Author:** Abhirup Konwar  
**Source:** MeetCyber  
**Date:** Sep 7, 2025  
**URL:** https://medium.com/meetcyber/shodan-recon-tips-352f0d7e8fdd

### Overview
Helpful shodan commands for pentesters and bug hunters

### Initialize Shodan with your API Key
```bash
shodan init API_KEY_HERE
```

### Fetch all IPv4 Addresses of a target

#### Hostname filtering
```bash
shodan download results.json.gz "hostname:target.com"
```

#### SSL certificate filtering
```bash
shodan download results2.json.gz "ssl.cert.subject.cn:target.com"
```

#### Extract the IPs from it
```bash
shodan parse results.json.gz --fields ip_str > ips.txt
```

### Shadow/Hidden HTTP services running on ports (excluding 80,443)
While majority are busy in same two HTTP/s ports (80/443). Let's just exclude those and gain the power to see more untouched assets!!

#### Download in json compressed format
```bash
shodan download shadow-http.json.gz "hostname:target.com http -port:80 -port:443"
shodan download shadow-http2.json.gz "ssl.cert.subject.cn:target.com http -port:80 -port:443"
```

#### Extract the IPs from it
```bash
shodan parse...
```

---

## 4. Shodan Dorks to Find PII Data & Leaks
**Author:** It4chis3c  
**Source:** InfoSec Write-ups  
**Date:** Jun 4, 2025  
**URL:** https://infosecwriteups.com/shodan-dorks-to-find-pii-data-leaks-50ab8b101f61

### Overview
Shodan dorks to find publicly exposed PII data of your target

### Key Shodan Dorks

#### 1. Open Directories
Identifies open directories that may expose sensitive files.
```
hostname:"example.com" http.title:"index of /"
```

#### 2. Password Searches
Searches for pages containing the term "password"
```
hostname:"example.com" http.html:"password"
```

#### 3. Admin Interface Discovery
Finds administrative interfaces that could be vulnerable.
```
hostname:"example.com" http.html:"admin"
```

---

## Summary

This collection contains 4 security writeups focused on:

1. **Real-world SQL injection exploitation** - From Shodan reconnaissance to successful dashboard compromise
2. **Comprehensive security toolkit** - Advanced tools for network analysis, penetration testing, and digital privacy
3. **Shodan reconnaissance techniques** - Practical commands for asset discovery and vulnerability hunting
4. **PII data leak detection** - Specific Shodan dorks for finding exposed sensitive information

These writeups demonstrate the importance of:
- Proper security hygiene and configuration management
- The power of OSINT tools like Shodan for reconnaissance
- Critical vulnerabilities that arise from basic misconfigurations
- Advanced tooling for comprehensive security analysis

*Compiled on: October 8, 2025*  
*Source: Clipboard history using cliphist*
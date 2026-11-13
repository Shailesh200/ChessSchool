                                                                                                                                                                  
  Found these issues in the build:                                                                                                                                 
                                                                                                                                                                   
  - Non logged in user gets the new splash screen, but after splash screen where we show the ChessSchool Learn chess with coach who has your back, doesn't         
  work well in light mode, the Logo text is not visible, the logo image is light theme in light background                                                         
  - When user has system dark theme, then the splash screen is fine, but the text splashscreen shows in light theme color                                          
  - There should be Sign up / Log in flow for as default landing when user lands first after opening the app and no guest details are saved in storage like        
  for the first time                                                                                                                                               
                                                                                                                                                                   
  Login/Signup Screen:                                                                                                                                             
  - ChessSchool logo on the top can have some space from the top, it's too near to the top screen edge                                                             
  - Sign In text here in this screen needs to be center aligned                                                                                                    
  - Remove the helper text name@example.com and make placeholder as johndoe@something.com for email input                                                          
  - Continue as Google and Continue as Guest can be in Same line, extract Continue as text as a small helper text below OR text and make Google and Guest as       
  2 side-by-side button                                                                                                                                            
  - Remove Your Progress stays on this device text in this login screen                                                                                            
  - Remove Privacy Policy link from login screen                                                                                                                   
  -Reduce the font size in this screen so there is no scroll comes in this screen                            
- On clicking Create account should clear any error as well from login screen, also if there is any error during login, signup is also not working as well
- Should clear password on Create account click, can retain the email iD
- Create button text is not centered or showing empty text after Create                                                      
                                                                                                                                                                   
  General:                                                                                                                                                         
-  The Entroll tag text is in white color for dark screen
- Profile and Review tab on selected in the bottom nav doesn't highlight the selected nav
- Selected nav like in Profile, can have a subtle background color
- Gym should be a tab between play and learn, Since play tab in the bottom nav will be centered, we can highlight that little bit better, probably in different UI or color?
- Continue as for non logged in user when opened login page again is coming empty - "Continue with google or Continue as" are coming just
- Password input error state has square border, email has curved one - Fix password error boackground state css
- The current build shows error - Google Sign-in is misconfigured for this build. Add the Play App Signining SHA-1 for package com.chessschool.app in Google cloud (see Release.md)
- Onboarding steps continue button in dark mode has white text color
- Pick your coach- any coach assets are not coming in the app
- Pick your avatar still uses old avatar designs can you create same number of avatars as now and similar to what we show for non-logged in users Profile tab?



Learn Tab
- The start text can look like float up and down over the current milestone step
- Loading asset of moving from one page to another still uses the old asset
- Lessons tab, start button should always float over at the bottom instead of scrolling manually at the bottom
- Should have mute/unmute button in each play match
- We are still using the old elevenlabs audio, can you check the new voices that is mentioned in the Grok bot consolidated plan and use that instead across?
- Dont need skills in this class section in mweb and mobile view, we already can see the list
- lesson view Logo text goes behind the mobile status bar
- THere is too much CLS whenever doing any lesson, if the text speaking by the coach is too big, we can show one line at a time, once the reading is done by the coach then we can show next content, but the chess board shouldn't move from his positoon ever
- the lessons that doesn't have any inputs, that has only next or got it button, can not show Hints Used card in lesson overview page.
- 1 day streak bold text should only come for the first lesson of the day
- Daiy goal if it is already shown to the user, then no need to show it again
- multiple cholce can be 2 col 2 row UI, but no lesson should ever have any type of scroll
- Continue button should move to next lesson not the first lesson user has already completed
- After completing one class, the next class is not unlocking
- Daily goal, coach text - The Chess Board next. You've got this text can be at the top in Learn tab
- Search can be just a floating button at the top right
- Remove Gym hyper link from the learn tab, since it will be a new bottom nav tab
- Unlock 3 classes if user has not logged in, on clicking next locked class, show a bottom nav to enroll/login screen link


Gym tab
- No need to have a search button here
- THe daily puzzles should always comes from the genre of lessons which users has already completed (make sure no need to repeat the lesson in the puzzle)
- Daily Puzzle consists of single puzzle a day, no need to keep on continuing it, can show Daily puzzle completed as well if done and show the timer of next day 12AM when a new puzzle comes
- Gym tab will only come for logged-in/enrolled user

Play tab
- Should not have play with coach if user is not enrolled, only bot and friend should come
- The layout can be improved here, i have to scroll to select different bot/coach after selecting how do you want to play part
- Ash toggle don't need it, it can be present always (as a coach not bot)
- Skye Kira Rex Ash are coaches, on selection of Play with bots, old names from old ui Pip etc should come (can use the same logo of bots as before for now)

Profile tab
- User should still be able to see some settings hyper link for not-logged in user with theme toggle
- Dark mode Student Id has whilte color texts
- New user player strength is coming 842? how?
- Logout and Delete button should be error and dangerous color respectively
- Privacy Policy should be removed at the student id screen page
- Badges assests are also not visible in the Profile tab
- There are lot of discrepancies in the features we support in old view and in new view, can we triage that in depth and add support for them


There are lot of CSS ui/ux quality issues in the app, please audit them properly in depth and fix them properly








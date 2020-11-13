ECHO OFF
call C:\Users\%username%\anaconda3\Scripts\activate.bat
call conda env create -f windows_environment.yaml
call conda activate eigendata
echo Enter the login details from npm
call npm login 
call jupyter labextension install @molinsp/eigendata
PAUSE
